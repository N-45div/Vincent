import { describe, expect, test } from "bun:test";
import { initWorkflow } from "./main";
import type { Config } from "./main";

describe("initWorkflow", () => {
  test("returns one handler with correct cron schedule", async () => {
    const testSchedule = "0 0 * * *";
    const config = { schedule: testSchedule } as Config;

    const handlers = initWorkflow(config);

    expect(handlers).toBeArray();
    expect(handlers).toHaveLength(1);
    expect(handlers[0].trigger.config.schedule).toBe(testSchedule);
  });
});
