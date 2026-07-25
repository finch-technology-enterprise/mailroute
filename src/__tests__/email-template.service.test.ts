import { describe, it, expect } from "vitest";

describe("template substitution logic", () => {
  function processTemplate(
    subject: string,
    content: string,
    replacements: Record<string, string>,
  ) {
    let processedSubject = subject;
    let processedContent = content;

    Object.entries(replacements).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      processedSubject = processedSubject.split(token).join(value);
      processedContent = processedContent.split(token).join(value);
    });

    return { subject: processedSubject, content: processedContent };
  }

  it("substitutes a single placeholder", () => {
    const result = processTemplate("Hello {{name}}", "<p>Hello {{name}}</p>", {
      name: "Alice",
    });
    expect(result.subject).toBe("Hello Alice");
    expect(result.content).toBe("<p>Hello Alice</p>");
  });

  it("substitutes multiple placeholders", () => {
    const result = processTemplate(
      "Hi {{first}} {{last}}",
      "<p>{{first}} {{last}}</p>",
      { first: "John", last: "Doe" },
    );
    expect(result.subject).toBe("Hi John Doe");
    expect(result.content).toBe("<p>John Doe</p>");
  });

  it("handles zero replacements", () => {
    const result = processTemplate("Hello {{name}}", "<p>{{name}}</p>", {});
    expect(result.subject).toBe("Hello {{name}}");
    expect(result.content).toBe("<p>{{name}}</p>");
  });

  it("handles repeated placeholders", () => {
    const result = processTemplate("{{x}} + {{x}} = 2{{x}}", "{{x}}", {
      x: "1",
    });
    expect(result.subject).toBe("1 + 1 = 21");
  });

  it("is not vulnerable to regex injection", () => {
    const result = processTemplate("test", "test", {
      "(.)": "injected",
    });
    expect(result.content).toBe("test");
  });

  it("is not vulnerable to split join special chars", () => {
    const result = processTemplate("a$`$1$$b", "a$`$1$$b", {
      "$`": "injected",
    });
    expect(result.subject).toBe("a$`$1$$b");
  });
});
