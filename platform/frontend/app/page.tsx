"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchPricing, Plan, PricingResponse } from "../lib/api";

function featureLines(plan: Plan): string[] {
  const lines = [
    `${plan.max_sites === -1 ? "Unlimited" : plan.max_sites} monitored site${plan.max_sites === 1 ? "" : "s"}`,
    `${plan.history_days === -1 ? "Unlimited" : `${plan.history_days}-day`} sighting history`,
    plan.webhooks ? "Real-time webhook ingestion" : "Polling ingestion",
    plan.taxii_feed ? "TAXII 2.1 feed for SIEM/SOAR" : null,
    plan.custom_mapping_rules ? "Custom ATT&CK mapping rules" : null,
    `ATT&CK domains: ${plan.attack_domains.join(", ")}`,
    plan.pentapi_integration !== "none" ? `Pentapi integration (${plan.pentapi_integration})` : null,
    plan.sso ? "SSO / SAML, RBAC, audit logs" : null,
  ];
  return lines.filter((l): l is string => Boolean(l));
}

export default function LandingPage() {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing()
      .then(setPricing)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="container">
      <h1>NetAlertX &rarr; MITRE ATT&amp;CK Bridge</h1>
      <p>
        Watches your NetAlertX network events and enriches them with MITRE ATT&amp;CK
        technique context, delivered as STIX 2.1 Sightings.
      </p>
      <p>
        <Link className="btn" href="/signup">
          Start your {pricing?.trial_days ?? 7}-day free trial
        </Link>
      </p>

      {error && <p className="error">Couldn&apos;t load pricing: {error}</p>}

      <div className="pricing-grid">
        {pricing?.plans.map((plan) => (
          <div className="card plan-card" key={plan.tier}>
            <h3>{plan.tier}</h3>
            <ul>
              {featureLines(plan).map((line) => (
                <li key={line}>&#10003; {line}</li>
              ))}
            </ul>
            {plan.self_serve ? (
              <Link className="btn" href="/signup">
                Start free trial
              </Link>
            ) : (
              <a className="btn btn-secondary" href={`mailto:${plan.contact_email}`}>
                Contact sales &mdash; {plan.contact_email}
              </a>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
