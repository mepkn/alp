import { expect, test } from "vitest";
import { sharedUrl } from "./share";

test("prefers the extracted webUrl", () => {
  expect(sharedUrl("https://a.example/x", "other https://b.example")).toBe("https://a.example/x");
});

test("finds the first URL in shared text", () => {
  expect(sharedUrl(null, "Cool article https://example.com/a?b=1 via app")).toBe(
    "https://example.com/a?b=1",
  );
  expect(sharedUrl(null, "See (https://example.com/x).")).toBe("https://example.com/x");
});

test("undefined when there is no URL", () => {
  expect(sharedUrl(null, "just some text")).toBeUndefined();
  expect(sharedUrl(null, null)).toBeUndefined();
  expect(sharedUrl("", "ftp://example.com")).toBeUndefined();
});
