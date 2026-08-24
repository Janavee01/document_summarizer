"use client";

import { useEffect } from "react";

/*
 * Renders its own document — global styles and the root layout are
 * not applied here, so all styling is inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          color: "#18181b",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <div
          role="alert"
          style={{
            maxWidth: "28rem",
            width: "100%",
            padding: "2rem",
            border: "1px solid #e4e4e7",
            borderRadius: "0.75rem",
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
            Something went wrong.
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              marginBottom: 0,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "#52525b",
            }}
          >
            The application hit an unexpected error. Please try again — if the
            problem continues, reload the page.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.75rem",
                marginBottom: 0,
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#a1a1aa",
              }}
            >
              Error ID: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.25rem",
              width: "100%",
              padding: "0.625rem 1rem",
              border: "none",
              borderRadius: "0.5rem",
              backgroundColor: "#18181b",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
