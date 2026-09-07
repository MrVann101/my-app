import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCronJob } from "@/lib/cron";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const mockedLogger = vi.mocked(logger);

describe("cron runner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs start and completion metrics", async () => {
    await expect(runCronJob("test_job", async () => ({ processed: 3, failed: 0 }))).resolves.toEqual({ processed: 3, failed: 0 });
    expect(mockedLogger.info).toHaveBeenCalledWith("cron_started", { job: "test_job" });
    expect(mockedLogger.info).toHaveBeenCalledWith("cron_completed", expect.objectContaining({ job: "test_job", processed: 3, failed: 0 }));
  });

  it("logs failure details and rethrows for the route to report", async () => {
    await expect(runCronJob("broken_job", async () => { throw new Error("database unavailable"); })).rejects.toThrow("database unavailable");
    expect(mockedLogger.error).toHaveBeenCalledWith("cron_failed", expect.objectContaining({ job: "broken_job", error: "database unavailable" }));
  });
});
