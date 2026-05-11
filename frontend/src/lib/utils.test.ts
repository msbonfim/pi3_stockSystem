import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("combina classes e resolve conflitos Tailwind (twMerge)", () => {
    expect(cn("px-2 py-1", "px-4")).toContain("px-4");
    expect(cn("px-2 py-1", "px-4")).toContain("py-1");
  });

  it("ignora valores falsy", () => {
    expect(cn("a", undefined, false && "b", "c")).toBe("a c");
  });
});
