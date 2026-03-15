import { describe, it, expect } from "vitest";
import { getDataviewApi, isDataviewAvailable } from "../utils/dataviewIntegration";

function makeApp(dvApi: unknown = null) {
  return {
    plugins: {
      plugins: {
        dataview: dvApi !== null ? { api: dvApi } : undefined,
      },
    },
  };
}

describe("getDataviewApi", () => {
  it("returns the api object when dataview is loaded", () => {
    const mockApi = { pages: () => ({ values: [] }) };
    const app = makeApp(mockApi);
    expect(getDataviewApi(app as never)).toBe(mockApi);
  });

  it("returns null when dataview plugin is absent", () => {
    const app = { plugins: { plugins: {} } };
    expect(getDataviewApi(app as never)).toBeNull();
  });

  it("returns null when plugins object is missing", () => {
    expect(getDataviewApi({} as never)).toBeNull();
  });
});

describe("isDataviewAvailable", () => {
  it("returns true when api exists", () => {
    const app = makeApp({ pages: () => ({ values: [] }) });
    expect(isDataviewAvailable(app as never)).toBe(true);
  });

  it("returns false when dataview is absent", () => {
    const app = { plugins: { plugins: {} } };
    expect(isDataviewAvailable(app as never)).toBe(false);
  });
});
