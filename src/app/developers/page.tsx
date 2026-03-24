"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";

export default function DevelopersPage() {
  return (
    <div className="h-[calc(100vh-2rem)] -m-4 overflow-hidden">
      <ApiReferenceReact
        configuration={{
          url: "/api/v1/openapi.json",
          darkMode: true,
          layout: "modern",
          theme: "purple",
          authentication: {
            preferredSecurityScheme: "bearerAuth",
          },
          hiddenClients: ["php", "ruby", "swift", "kotlin", "java", "csharp", "clojure", "powershell", "r", "objc"],
          customCss: `
            .scalar-app { --scalar-background-1: transparent; }
            .references-header { display: none; }
          `,
          metaData: {
            title: "API Reference — Content Automation",
          },
        }}
      />
    </div>
  );
}
