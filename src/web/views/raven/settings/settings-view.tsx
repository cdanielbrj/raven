import { useCallback, useEffect, useState } from "react";
import { request } from "../../../api";
import { ErrorMessage } from "../../../themes/raven/components/error-message/error-message";
import type {
  ProviderConnectionStatus,
  SettingsOverview,
} from "../../../types";
import "./settings-view.css";

export function SettingsView() {
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingProviderId, setCheckingProviderId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      setOverview(await request<SettingsOverview>("/api/v1/settings"));
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load settings",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkProvider = async (providerId: string) => {
    setCheckingProviderId(providerId);
    try {
      setOverview(
        await request<SettingsOverview>(
          `/api/v1/settings/providers/${providerId}/check`,
          { method: "POST" },
        ),
      );
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not check providers",
      );
    } finally {
      setCheckingProviderId(null);
    }
  };

  return (
    <section className="page settings-page">
      <p className="eyebrow">SETTINGS</p>
      <h1>Raven, locally.</h1>
      {error && <ErrorMessage message={error} />}
      {!overview && !error && <p className="muted">Loading local settings…</p>}
      {overview && (
        <>
          <section className="settings-section">
            <div className="settings-section-header">
              <div>
                <p className="section-label">Providers</p>
                <p>Check each external service only when you ask Raven to.</p>
              </div>
            </div>
            <div className="settings-panel provider-list">
              {overview.providers.map((provider) => (
                <div className="provider-row" key={provider.id}>
                  <div>
                    <h2>{provider.label}</h2>
                    <p>{providerDescription(provider.status, provider)}</p>
                  </div>
                  <div className="provider-row-actions">
                    {provider.status !== "not_configured" && (
                      <button
                        className="settings-action"
                        disabled={checkingProviderId !== null}
                        onClick={() => void checkProvider(provider.id)}
                      >
                        {checkingProviderId === provider.id
                          ? "Checking…"
                          : "Check"}
                      </button>
                    )}
                    <span className={`provider-status ${provider.status}`}>
                      {providerStatusLabel(provider.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <p className="section-label">Local data</p>
            <div className="settings-metrics">
              <Metric
                label="SQLite storage"
                value={formatBytes(overview.database.sizeBytes)}
              />
              <Metric
                label="Tracked media"
                value={String(overview.database.trackedItems)}
              />
              <Metric
                label="Upcoming events"
                value={String(overview.database.upcomingEvents)}
              />
              <Metric
                label="Catalog snapshots"
                value={String(overview.database.discoverySnapshots)}
              />
            </div>
          </section>

          <section className="settings-section settings-installation">
            <p className="section-label">Installation</p>
            <div className="settings-panel installation-row">
              <div>
                <h2>Raven v{overview.installation.version}</h2>
                <p>Data stays in this local SQLite installation.</p>
              </div>
              <span className="installation-mode">
                {overview.installation.mode}
              </span>
              <span className="schema-version">
                Schema {overview.database.schemaVersion}
              </span>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function providerStatusLabel(status: ProviderConnectionStatus): string {
  return {
    available: "Available",
    unavailable: "Unavailable",
    not_checked: "Not checked",
    not_configured: "Not configured",
  }[status];
}

function providerDescription(
  status: ProviderConnectionStatus,
  provider: SettingsOverview["providers"][number],
): string {
  if (status === "not_configured") {
    return "Optional fallback is not configured on this installation.";
  }
  if (!provider.lastCheckedAt) {
    return "No manual connection check has been run yet.";
  }
  if (status === "unavailable") {
    return `Last checked ${formatDate(provider.lastCheckedAt)}.`;
  }
  return `Last connected ${formatDate(provider.lastSucceededAt)}.`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}
