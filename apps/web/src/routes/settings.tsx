import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — OpenATS" },
      { name: "description", content: "Configure AI models, extraction, and workspace preferences." },
    ],
  }),
  component: SettingsPage,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass diag-highlight panel-in relative p-5">
      <div className="relative z-10">
        <h2 className="font-display text-lg font-semibold text-charcoal-earth">
          {title}
        </h2>
        <p className="mt-1 text-xs text-warm-taupe">{description}</p>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: string;
}) {
  return (
    <label className="block">
      <div className="font-mono-caps mb-1.5 text-warm-taupe">
        {label} {mono && <span className="text-charcoal-earth/70">· {mono}</span>}
      </div>
      {children}
    </label>
  );
}

function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.getModels,
  });

  const [scoringModel, setScoringModel] = useState("");
  const [compareModel, setCompareModel] = useState("");
  const [chatModel, setChatModel] = useState("");
  const [profileModel, setProfileModel] = useState("");
  const [nvidiaLinkModel, setNvidiaLinkModel] = useState("");

  useEffect(() => {
    if (settingsData?.selected) {
      setScoringModel(settingsData.selected.scoring_model || "");
      setCompareModel(settingsData.selected.compare_model || "");
      setChatModel(settingsData.selected.chat_model || "");
      setProfileModel(settingsData.selected.profile_model || "");
      setNvidiaLinkModel(settingsData.selected.nvidia_link_model || "");
    }
  }, [settingsData]);

  const mutation = useMutation({
    mutationFn: settingsApi.updateModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      alert("Settings saved successfully!");
    },
    onError: (err: any) => {
      alert("Failed to save settings: " + (err.response?.data?.error?.message || err.message));
    },
  });

  const handleSave = () => {
    mutation.mutate({
      scoring_model: scoringModel,
      compare_model: compareModel,
      chat_model: chatModel,
      profile_model: profileModel,
      nvidia_link_model: nvidiaLinkModel,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const availableModels = settingsData?.available || [];
  const nvidiaAvailable = settingsData?.nvidiaAvailable && settingsData.nvidiaAvailable.length > 0
    ? settingsData.nvidiaAvailable
    : [
        'z-ai/glm-5.2',
        'deepseek-ai/deepseek-v4-flash',
        'meta/llama-3.1-70b-instruct',
        'meta/llama-3.3-70b-instruct',
        'mistralai/mistral-large-2-instruct',
      ];

  // If the currently selected model isn't in the list (e.g. custom string), append it so it shows in the dropdown
  const nvidiaModelList = Array.from(new Set([...(nvidiaLinkModel ? [nvidiaLinkModel] : []), ...nvidiaAvailable]));

  return (
    <section className="mt-4 space-y-6">
      <div className="px-1">
        <div className="font-mono-caps text-warm-taupe">workspace / settings</div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-charcoal-earth">
          Settings
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Section
          title="AI Models"
          description="Choose which local and cloud models drive extraction, embedding, link analysis, and scoring."
        >
          <Field label="scoring_model" mono="ollama / vllm">
            <select
              className="input-glass w-full"
              value={scoringModel}
              onChange={(e) => setScoringModel(e.target.value)}
            >
              <option value="">Select a model</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="compare_model" mono="ollama / vllm">
            <select
              className="input-glass w-full"
              value={compareModel}
              onChange={(e) => setCompareModel(e.target.value)}
            >
              <option value="">Select a model</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="chat_model" mono="ollama / vllm">
            <select
              className="input-glass w-full"
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
            >
              <option value="">Select a model</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="profile_model" mono="ollama / vllm">
            <select
              className="input-glass w-full"
              value={profileModel}
              onChange={(e) => setProfileModel(e.target.value)}
            >
              <option value="">Select a model</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="nvidia_link_model" mono="nvidia nim (cloud)">
            <select
              className="input-glass w-full"
              value={nvidiaLinkModel}
              onChange={(e) => setNvidiaLinkModel(e.target.value)}
            >
              <option value="">Select an NVIDIA NIM model</option>
              {nvidiaModelList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section
          title="Profile extraction"
          description="Configure how the pipeline pulls structured data out of resumes."
        >
          <Field label="parser">
            <select className="input-glass w-full" defaultValue="pdfplumber + heuristics" disabled>
              <option>PyMuPDF4LLM</option>
            </select>
          </Field>
          <Field label="max_pages">
            <input className="input-glass w-full" defaultValue="20" disabled />
          </Field>
          <Field label="language_hint">
            <input className="input-glass w-full" defaultValue="auto" disabled />
          </Field>
        </Section>

        <Section
          title="Tier thresholds"
          description="Score bands that place candidates into tiers A, B, and C."
        >
          <Field label="tier_a_min">
            <input className="input-glass w-full" defaultValue="80" disabled />
          </Field>
          <Field label="tier_b_min">
            <input className="input-glass w-full" defaultValue="60" disabled />
          </Field>
          <Field label="reject_below">
            <input className="input-glass w-full" defaultValue="35" disabled />
          </Field>
        </Section>

        <Section
          title="Workspace"
          description="Global preferences for the OpenATS workspace."
        >
          <Field label="workspace_name">
            <input className="input-glass w-full" defaultValue="OpenATS · Local" disabled />
          </Field>
          <Field label="timezone">
            <select className="input-glass w-full" defaultValue="UTC" disabled>
              <option>UTC</option>
            </select>
          </Field>
        </Section>
      </div>

      <div className="flex justify-end">
        <button
          className="btn-glass-primary"
          style={{ padding: "12px 32px" }}
          onClick={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </section>
  );
}