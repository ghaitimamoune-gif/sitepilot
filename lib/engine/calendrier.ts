import { ajouterJours, jourSemaine, type ISODate } from "@/lib/dates";
import type { TypeJournee } from "./types";

export interface ExceptionCalendrier {
  ouvert: boolean;
  type: TypeJournee;
  note?: string | null;
}

export interface ReglesCalendrier {
  /** Jours de fermeture hebdomadaire, 0 = dimanche ... 6 = samedi. Par défaut le lundi. */
  joursFermetureHebdo: number[];
  /** Jours de type « week-end ». Par défaut samedi et dimanche. */
  joursWeekend: number[];
  /** Jours fériés et fermetures exceptionnelles. */
  exceptions: Map<ISODate, ExceptionCalendrier>;
}

export const REGLES_PAR_DEFAUT: ReglesCalendrier = {
  joursFermetureHebdo: [1],
  joursWeekend: [6, 0],
  exceptions: new Map(),
};

const HORIZON_MAX = 60;

export class Calendrier {
  constructor(private readonly regles: ReglesCalendrier = REGLES_PAR_DEFAUT) {}

  estOuvert(date: ISODate): boolean {
    const ex = this.regles.exceptions.get(date);
    if (ex) return ex.ouvert;
    return !this.regles.joursFermetureHebdo.includes(jourSemaine(date));
  }

  typeJournee(date: ISODate): TypeJournee {
    const ex = this.regles.exceptions.get(date);
    if (ex) return ex.type;
    return this.regles.joursWeekend.includes(jourSemaine(date)) ? "weekend" : "semaine";
  }

  note(date: ISODate): string | null {
    return this.regles.exceptions.get(date)?.note ?? null;
  }

  /** Premier jour ouvert strictement après `date`. */
  prochainJourOuvert(date: ISODate): ISODate {
    let d = date;
    for (let i = 0; i < HORIZON_MAX; i++) {
      d = ajouterJours(d, 1);
      if (this.estOuvert(d)) return d;
    }
    return ajouterJours(date, 1);
  }

  /** Dernier jour ouvert strictement avant `date`. */
  jourOuvertPrecedent(date: ISODate): ISODate {
    let d = date;
    for (let i = 0; i < HORIZON_MAX; i++) {
      d = ajouterJours(d, -1);
      if (this.estOuvert(d)) return d;
    }
    return ajouterJours(date, -1);
  }

  /** Jour ouvert dont le lendemain est fermé. */
  estVeilleFermeture(date: ISODate): boolean {
    return this.estOuvert(date) && !this.estOuvert(ajouterJours(date, 1));
  }

  /** Les `n` prochains jours ouverts à partir de `depuis` (inclus s'il est ouvert). */
  joursOuverts(depuis: ISODate, n: number): ISODate[] {
    const res: ISODate[] = [];
    let d = depuis;
    let garde = 0;
    while (res.length < n && garde < HORIZON_MAX * 4) {
      if (this.estOuvert(d)) res.push(d);
      d = ajouterJours(d, 1);
      garde++;
    }
    return res;
  }

  /** Jours ouverts entre deux dates incluses. */
  joursOuvertsEntre(debut: ISODate, fin: ISODate): ISODate[] {
    const res: ISODate[] = [];
    let d = debut;
    let garde = 0;
    while (d <= fin && garde < HORIZON_MAX * 4) {
      if (this.estOuvert(d)) res.push(d);
      d = ajouterJours(d, 1);
      garde++;
    }
    return res;
  }
}
