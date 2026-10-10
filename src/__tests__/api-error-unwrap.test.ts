import {
  ApiError,
  shouldRetryQuery,
  unwrap,
  unwrapVoid,
} from "../lib/query/api-error";

const okResponse = { status: 200, statusText: "OK" };

describe("unwrap", () => {
  it("returns data on success", () => {
    expect(unwrap({ data: { id: 1 }, response: okResponse })).toEqual({
      id: 1,
    });
  });

  it("throws ApiError with the backend envelope", () => {
    expect(() =>
      unwrap({
        error: {
          error: "NotFound",
          message: "Project not found",
          status_code: 404,
        },
        response: { status: 404, statusText: "Not Found" },
      }),
    ).toThrow(new ApiError(404, "NotFound", "Project not found"));
  });

  it("keeps the envelope's machine-readable reason", () => {
    try {
      unwrap({
        error: {
          error: "Conflict",
          message: "Company must keep at least one admin",
          reason: "last_admin",
        },
        response: { status: 409, statusText: "Conflict" },
      });
      throw new Error("did not throw");
    } catch (caught) {
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).reason).toBe("last_admin");
    }
  });

  it("falls back to the HTTP status when the body is not an envelope", () => {
    try {
      unwrap({
        error: "<html>",
        response: { status: 502, statusText: "Bad Gateway" },
      });
      throw new Error("did not throw");
    } catch (caught) {
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(502);
      expect((caught as ApiError).code).toBe("HttpError");
    }
  });

  it("unwrapVoid ignores empty bodies but still throws on error", () => {
    expect(() =>
      unwrapVoid({ response: { status: 204, statusText: "" } }),
    ).not.toThrow();
    expect(() =>
      unwrapVoid({
        error: { error: "Forbidden" },
        response: { status: 403, statusText: "" },
      }),
    ).toThrow(ApiError);
  });
});

describe("shouldRetryQuery", () => {
  it("does not retry a client error the backend would repeat", () => {
    expect(shouldRetryQuery(0, new ApiError(404, "NotFound", "gone"))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ApiError(403, "Forbidden", "no"))).toBe(
      false,
    );
  });

  it("retries once a server, network or transient client error", () => {
    expect(shouldRetryQuery(0, new ApiError(500, "Error", "boom"))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(429, "TooMany", "later"))).toBe(
      true,
    );
    expect(shouldRetryQuery(0, new TypeError("Network request failed"))).toBe(
      true,
    );
    expect(shouldRetryQuery(1, new ApiError(500, "Error", "boom"))).toBe(false);
  });
});
