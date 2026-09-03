import { describe, expect, it } from "vitest";
import { nextRun, describeSchedule, formatNextRun } from "@/lib/routines";

// Quarta-feira, 19 de agosto de 2026, 10:00.
const wednesday = new Date(2026, 7, 19, 10, 0, 0);

describe("nextRun semanal", () => {
  it("agenda para a próxima segunda quando hoje é quarta", () => {
    const next = nextRun(
      { frequency: "semanal", weekday: 1, day_of_month: null, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next?.getDay()).toBe(1);
    expect(next!.getTime()).toBeGreaterThan(wednesday.getTime());
    expect(next?.getHours()).toBe(8);
  });

  it("pula para a semana seguinte quando o horário de hoje já passou", () => {
    const next = nextRun(
      { frequency: "semanal", weekday: 3, day_of_month: null, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next?.getDay()).toBe(3);
    expect(next!.getTime() - wednesday.getTime()).toBeGreaterThan(6 * 86_400_000);
  });

  it("agenda ainda para hoje quando o horário não passou", () => {
    const next = nextRun(
      { frequency: "semanal", weekday: 3, day_of_month: null, specific_date: null, run_at: "18:00" },
      wednesday,
    );
    expect(next?.getDate()).toBe(19);
    expect(next?.getHours()).toBe(18);
  });

  it("devolve null sem dia da semana definido", () => {
    expect(
      nextRun({ frequency: "semanal", weekday: null, day_of_month: null, specific_date: null, run_at: "08:00" }, wednesday),
    ).toBeNull();
  });
});

describe("nextRun quinzenal", () => {
  it("cai sempre em semana par, respeitando o dia escolhido", () => {
    const next = nextRun(
      { frequency: "quinzenal", weekday: 1, day_of_month: null, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next?.getDay()).toBe(1);
    const weekIndex = Math.floor(next!.getTime() / (7 * 86_400_000));
    expect(weekIndex % 2).toBe(0);
  });

  it("mantém pelo menos uma semana de distância", () => {
    const next = nextRun(
      { frequency: "quinzenal", weekday: 1, day_of_month: null, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next!.getTime()).toBeGreaterThan(wednesday.getTime());
  });
});

describe("nextRun mensal", () => {
  it("usa o mês seguinte quando o dia já passou", () => {
    const next = nextRun(
      { frequency: "mensal", weekday: null, day_of_month: 1, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next?.getMonth()).toBe(8);
    expect(next?.getDate()).toBe(1);
  });

  it("usa o mês corrente quando o dia ainda vem", () => {
    const next = nextRun(
      { frequency: "mensal", weekday: null, day_of_month: 25, specific_date: null, run_at: "08:00" },
      wednesday,
    );
    expect(next?.getMonth()).toBe(7);
    expect(next?.getDate()).toBe(25);
  });
});

describe("nextRun data específica", () => {
  it("agenda para a data escolhida", () => {
    const next = nextRun(
      { frequency: "data_especifica", weekday: null, day_of_month: null, specific_date: "2026-09-10", run_at: "09:30" },
      wednesday,
    );
    expect(next?.getDate()).toBe(10);
    expect(next?.getMonth()).toBe(8);
    expect(next?.getHours()).toBe(9);
  });

  it("não reagenda datas passadas", () => {
    expect(
      nextRun(
        { frequency: "data_especifica", weekday: null, day_of_month: null, specific_date: "2026-01-01", run_at: "09:00" },
        wednesday,
      ),
    ).toBeNull();
  });
});

describe("descrição legível", () => {
  it("descreve a frequência em português", () => {
    expect(
      describeSchedule({ frequency: "semanal", weekday: 1, day_of_month: null, specific_date: null, run_at: "08:00" }),
    ).toBe("Toda segunda, 08:00");
    expect(
      describeSchedule({ frequency: "mensal", weekday: null, day_of_month: 5, specific_date: null, run_at: "08:00" }),
    ).toBe("Todo dia 5, 08:00");
  });

  it("avisa quando não há próxima execução", () => {
    expect(
      formatNextRun(
        { frequency: "data_especifica", weekday: null, day_of_month: null, specific_date: null, run_at: "08:00" },
        wednesday,
      ),
    ).toBe("Sem próxima execução");
  });
});
