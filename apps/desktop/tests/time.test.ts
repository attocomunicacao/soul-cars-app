/**
 * Testes (Vitest) de src/renderer/src/lib/time.ts (tempos relativos).
 */
import { describe, expect, it } from "vitest";
import { haQuanto } from "../src/renderer/src/lib/time";

const agora = Date.parse("2026-10-16T12:00:00Z");

describe("haQuanto", () => {
  it("escolhe a unidade pelo tamanho do intervalo", () => {
    expect(haQuanto("2026-10-16T11:59:40Z", agora)).toBe("agora");
    expect(haQuanto("2026-10-16T11:48:00Z", agora)).toBe("12 min");
    expect(haQuanto("2026-10-16T09:00:00Z", agora)).toBe("3 h");
    expect(haQuanto("2026-10-14T12:00:00Z", agora)).toBe("2 d");
  });
  it("devolve vazio para datas ausentes ou inválidas", () => {
    expect(haQuanto(null, agora)).toBe("");
    expect(haQuanto("lixo", agora)).toBe("");
  });
});
