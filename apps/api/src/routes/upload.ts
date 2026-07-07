import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { withTransaction } from '../db/pool';
import { resumeQueue } from '../db/redis';
import { authenticate } from '../middleware/auth';
import { config } from '../config';

const router = Router();
router.use(authenticate);

// ─── Multer Configuration ─────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const jobId = req.params.jobId;
    const uploadPath = path.join(config.upload.dir, jobId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9._-]/gi, '_');
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeMb * 1024 * 1024,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

// ─── Hash file helper ─────────────────────────────────────────────────────────

function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Derive a placeholder email from filename + hash to ensure uniqueness.
 * Pattern: if filename matches "firstname_lastname@email.pdf" we extract the email.
 * Otherwise we create a placeholder.
 */
function deriveEmailFromFilename(
  filename: string,
  contentHash: string
): { email: string; isPlaceholder: boolean; fullName: string } {
  const base = path.basename(filename, path.extname(filename));

  // Try to match "Name <email>" or "name_email@domain" patterns
  const emailMatch = base.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    const email = emailMatch[0];
    const fullName = base.replace(email, '').replace(/[_\-]+/g, ' ').trim() || base;
    return { email, isPlaceholder: false, fullName };
  }

  // Anonymous candidate
  const fullName = base.replace(/[_\-]+/g, ' ').trim();
  const shortHash = contentHash.slice(0, 12);
  const email = `${shortHash}@placeholder.openats`;
  return { email, isPlaceholder: true, fullName };
}

// ─── POST /jobs/:jobId/resumes ────────────────────────────────────────────────

router.post(
  '/:jobId/resumes',
  upload.array('resumes', 20),
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({
        error: { code: 'NO_FILES', message: 'No PDF files were uploaded' },
      });
      return;
    }

    const { jobId } = req.params;

    const results: { filename: string; applicationId: string; status: string }[] = [];

    for (const file of files) {
      try {
        const contentHash = await computeFileHash(file.path);
        const { email, fullName } = deriveEmailFromFilename(file.originalname, contentHash);

        const applicationId = await withTransaction(async (client) => {
          // Upsert candidate by email
          const candidateRes = await client.query<{ id: string }>(
            `INSERT INTO candidates (id, full_name, email)
             VALUES ($1, $2, $3)
             ON CONFLICT (email)
             DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = NOW()
             RETURNING id`,
            [uuidv4(), fullName, email]
          );
          const candidateId = candidateRes.rows[0].id;

          // Check for duplicate resume by hash
          const dupCheck = await client.query<{ id: string }>(
            `SELECT r.id FROM resumes r
             JOIN applications a ON a.resume_id = r.id
             WHERE r.content_hash = $1 AND a.job_id = $2`,
            [contentHash, jobId]
          );
          if (dupCheck.rows[0]) {
            // Skip duplicate; delete the just-uploaded file
            fs.unlink(file.path, () => null);
            results.push({
              filename: file.originalname,
              applicationId: dupCheck.rows[0].id,
              status: 'duplicate',
            });
            // We need to abort this iteration without aborting the transaction for other files
            // We throw a known sentinel to rollback and continue
            throw Object.assign(new Error('DUPLICATE_RESUME'), { isDuplicate: true, existingId: dupCheck.rows[0].id });
          }

          // Create resume record
          const resumeRes = await client.query<{ id: string }>(
            `INSERT INTO resumes
               (id, candidate_id, storage_path, content_hash, original_filename,
                file_size_bytes, mime_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING id`,
            [
              uuidv4(),
              candidateId,
              file.path,
              contentHash,
              file.originalname,
              file.size,
              file.mimetype,
            ]
          );
          const resumeId = resumeRes.rows[0].id;

          // Create application
          const appRes = await client.query<{ id: string }>(
            `INSERT INTO applications
               (id, job_id, candidate_id, resume_id, status)
             VALUES ($1,$2,$3,$4,'uploaded')
             RETURNING id`,
            [uuidv4(), jobId, candidateId, resumeId]
          );
          const appId = appRes.rows[0].id;

          // Create processing job record
          await client.query(
            `INSERT INTO resume_processing_jobs
               (id, application_id, status, attempts)
             VALUES ($1,$2,'queued',0)`,
            [uuidv4(), appId]
          );

          // Update application to queued
          await client.query(
            `UPDATE applications SET status = 'queued' WHERE id = $1`,
            [appId]
          );

          return appId;
        });

        // Add to BullMQ queue after transaction commits
        const bullJob = await resumeQueue.add(
          'process-resume',
          {
            applicationId,
            resumePath: file.path,
            jobId,
          },
          { jobId: applicationId }
        );

        // Store BullMQ job id in processing record
        await withTransaction(async (client) => {
          await client.query(
            `UPDATE resume_processing_jobs
             SET bullmq_job_id = $1
             WHERE application_id = $2`,
            [bullJob.id, applicationId]
          );
        });

        results.push({
          filename: file.originalname,
          applicationId,
          status: 'queued',
        });
      } catch (err: unknown) {
        const error = err as Error & { isDuplicate?: boolean; existingId?: string };
        if (error.isDuplicate) {
          results.push({
            filename: file.originalname,
            applicationId: error.existingId || '',
            status: 'duplicate',
          });
        } else {
          console.error(`[Upload] Failed to process ${file.originalname}:`, error.message);
          results.push({
            filename: file.originalname,
            applicationId: '',
            status: 'error',
          });
        }
      }
    }

    res.status(207).json({ results });
  }
);

export default router;
