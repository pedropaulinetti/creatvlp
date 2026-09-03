/**
 * Cálculo da próxima execução de uma rotina.
 * Espelha `public.routine_next_run` no banco — o banco continua sendo a fonte
 * de verdade; aqui é só a prévia mostrada no formulário.
 */
export type Frequency = "semanal" | "quinzenal" | "mensal" | "data_especifica";

export type RoutineSchedule = {
  frequency: Frequency;
  weekday: number | null;
  day_of_month: number | null;
  specific_date: string | null;
  run_at: string;
};

function withTime(date: Date, runAt: string): Date {
  const [hours, minutes] = runAt.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  return next;
}

const WEEK_MS = 7 * 86_400_000;

export function nextRun(schedule: RoutineSchedule, from: Date = new Date()): Date | null {
  if (schedule.frequency === "data_especifica") {
    if (!schedule.specific_date) return null;
    const candidate = withTime(new Date(`${schedule.specific_date}T12:00:00`), schedule.run_at);
    return candidate > from ? candidate : null;
  }

  if (schedule.frequency === "semanal" || schedule.frequency === "quinzenal") {
    if (schedule.weekday === null) return null;
    const delta = (schedule.weekday - from.getDay() + 7) % 7;
    let candidate = withTime(new Date(from.getTime() + delta * 86_400_000), schedule.run_at);
    if (candidate <= from) candidate = new Date(candidate.getTime() + WEEK_MS);

    if (schedule.frequency === "quinzenal") {
      // Mesma regra do banco: alterna semanas pares contadas desde a época.
      const weekIndex = Math.floor(candidate.getTime() / WEEK_MS);
      if (weekIndex % 2 === 1) candidate = new Date(candidate.getTime() + WEEK_MS);
    }
    return candidate;
  }

  if (schedule.day_of_month === null) return null;
  const thisMonth = withTime(
    new Date(from.getFullYear(), from.getMonth(), schedule.day_of_month),
    schedule.run_at,
  );
  if (thisMonth > from) return thisMonth;
  return withTime(new Date(from.getFullYear(), from.getMonth() + 1, schedule.day_of_month), schedule.run_at);
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function describeSchedule(schedule: RoutineSchedule): string {
  const time = schedule.run_at.slice(0, 5);
  switch (schedule.frequency) {
    case "semanal":
      return schedule.weekday === null ? "Semanal" : `Toda ${WEEKDAY_NAMES[schedule.weekday]}, ${time}`;
    case "quinzenal":
      return schedule.weekday === null ? "Quinzenal" : `Quinzenal, ${WEEKDAY_NAMES[schedule.weekday]} às ${time}`;
    case "mensal":
      return schedule.day_of_month === null ? "Mensal" : `Todo dia ${schedule.day_of_month}, ${time}`;
    case "data_especifica":
      return schedule.specific_date
        ? `Em ${new Date(`${schedule.specific_date}T12:00:00`).toLocaleDateString("pt-BR")}, ${time}`
        : "Data específica";
  }
}

export function formatNextRun(schedule: RoutineSchedule, from: Date = new Date()): string {
  const next = nextRun(schedule, from);
  if (!next) return "Sem próxima execução";
  return next.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
