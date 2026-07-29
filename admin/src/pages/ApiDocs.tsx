import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import AnimatedPage from "../components/AnimatedPage";
import { Link } from "react-router-dom";

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/openapi.json");
        if (!res.ok) throw new Error(`Failed to load spec (${res.status})`);
        setSpec(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load API spec");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const apiKey = typeof window !== "undefined"
    ? localStorage.getItem("mailroute_api_key")
    : null;

  if (loading) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer" style={{ height: 28, width: "40%", marginBottom: 32 }} />
          {[1,2,3].map(i => (
            <div key={i} className="card p-5">
              <div className="skeleton-shimmer" style={{ height: 14, width: "30%", marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "60%" }} />
            </div>
          ))}
        </div>
      </AnimatedPage>
    );
  }

  if (error) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="card p-6" style={{ color: "var(--red)" }}>
          <p>{error}</p>
        </div>
      </AnimatedPage>
    );
  }

  if (!apiKey) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="card p-6" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
            You need an API key to test the endpoints. Create one on the{" "}
            <Link to="/api-keys" style={{ color: "var(--accent)" }}>API Keys page</Link>.
          </p>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <h1 className="mb-6">API Documentation</h1>
      <p className="mb-6" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
        Your API key is pre-filled. Click "Try it out" on any endpoint to send a real request.
      </p>
      <div className="swagger-container">
        <SwaggerUI
          spec={spec as Record<string, unknown>}
          requestInterceptor={(req: any) => {
            req.headers["X-API-AUTH-KEY"] = apiKey;
            return req;
          }}
          defaultModelsExpandDepth={-1}
          docExpansion={"list" as any}
        />
      </div>
    </AnimatedPage>
  );
}
