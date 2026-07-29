"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, fetchMe, fetchSightings, getToken, startCheckout } from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [sightings, setSightings] = useState<any[] | null>(null);
  const [paymentRequired, setPaymentRequired] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    fetchMe()
      .then(setMe)
      .catch(() => router.push("/login"));

    fetchSightings()
      .then((bundle) => setSightings(bundle.objects.filter((o: any) => o.type === "sighting")))
      .catch((err: any) => {
        if (err && err.paymentRequired) {
          setPaymentRequired(err.detail);
        } else {
          setError(err.message || String(err));
        }
      });
  }, [router]);

  async function handleUpgrade(tier: "standard" | "pro") {
    try {
      const url = await startCheckout(tier);
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    }
  }

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Dashboard</h1>
        <button className="btn btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>

      {me && (
        <p>
          Signed in as <strong>{me.email}</strong> &middot; tier: <strong>{me.tier}</strong>{" "}
          {me.trial_active && me.tier === "trial" && (
            <>&middot; trial ends {new Date(me.trial_ends_at).toLocaleDateString()}</>
          )}
        </p>
      )}

      {paymentRequired && (
        <div className="banner">
          {paymentRequired}
          <div style={{ marginTop: "0.75rem" }}>
            <button className="btn" onClick={() => handleUpgrade("standard")}>
              Subscribe to Standard
            </button>{" "}
            <button className="btn" onClick={() => handleUpgrade("pro")}>
              Subscribe to Pro
            </button>{" "}
            <a className="btn btn-secondary" href="/#pricing">
              Compare plans
            </a>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {sightings && (
        <div className="card">
          <h3>Recent ATT&amp;CK Sightings</h3>
          {sightings.length === 0 ? (
            <p>No sightings yet &mdash; connect a NetAlertX instance to start seeing events here.</p>
          ) : (
            <ul>
              {sightings.map((s) => (
                <li key={s.id}>
                  <strong>{s.x_mitre_attack_id}</strong> &mdash; {s.description} (
                  {s.x_netalertx_device_mac})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
