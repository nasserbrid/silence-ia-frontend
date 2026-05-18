import { describe, it, expect } from "vitest";
import {
  applyMob,
  transformSession,
  extractScore,
  extractCitation,
  extractSynthese,
  fmtTime,
} from "../utils.js";

describe("applyMob", () => {
  it("returns desktop styles unchanged when not mobile", () => {
    const desktop = { color: "red", fontSize: 14 };
    expect(applyMob(false, desktop, { fontSize: 12 })).toEqual(desktop);
  });

  it("merges mobile overrides when mobile", () => {
    const desktop = { color: "red", fontSize: 14 };
    expect(applyMob(true, desktop, { fontSize: 12 })).toEqual({ color: "red", fontSize: 12 });
  });

  it("does not mutate the desktop object", () => {
    const desktop = { padding: 20 };
    applyMob(true, desktop, { padding: 10 });
    expect(desktop.padding).toBe(20);
  });
});

describe("transformSession", () => {
  it("maps all snake_case fields to camelCase", () => {
    const raw = {
      id: 42,
      created_at: "2024-06-01T10:00:00",
      type_discours: "pitch",
      type_discours_label: "Pitch",
      duree_prevue_min: 5,
      duree_effective_sec: 287,
      transcription: "Bonjour le monde",
      analyse: "# Rapport\n...",
      word_count: 3,
    };
    expect(transformSession(raw)).toEqual({
      id: 42,
      date: "2024-06-01T10:00:00",
      typeDiscours: "pitch",
      typeDiscoursLabel: "Pitch",
      dureeMinPrevue: 5,
      dureeEffectiveSec: 287,
      transcription: "Bonjour le monde",
      analyse: "# Rapport\n...",
      wordCount: 3,
    });
  });
});

describe("extractScore", () => {
  it("returns null for falsy inputs", () => {
    expect(extractScore("")).toBeNull();
    expect(extractScore(null)).toBeNull();
    expect(extractScore(undefined)).toBeNull();
  });

  it("extracts score from 'Score global : 78 %'", () => {
    expect(extractScore("Score global : 78 %")).toBe(78);
  });

  it("extracts score from 'Score final : 65%'", () => {
    expect(extractScore("Votre Score final : 65%")).toBe(65);
  });

  it("extracts score from bold markdown '**Score global : 82 %**'", () => {
    expect(extractScore("**Score global : 82 %**")).toBe(82);
  });

  it("falls back to any percentage when no score label", () => {
    expect(extractScore("Résultat : 50%")).toBe(50);
  });

  it("returns null when no percentage found", () => {
    expect(extractScore("Excellente prestation, bravo !")).toBeNull();
  });

  it("returns null for values above 100", () => {
    expect(extractScore("Score global : 101%")).toBeNull();
  });
});

describe("extractCitation", () => {
  it("returns null for falsy inputs", () => {
    expect(extractCitation("")).toBeNull();
    expect(extractCitation(null)).toBeNull();
  });

  it("extracts the last citation between guillemets", () => {
    const text =
      "«Première citation trop courte» «Votre présence sur scène était vraiment remarquable et captivante ce soir»";
    expect(extractCitation(text)).toBe(
      "Votre présence sur scène était vraiment remarquable et captivante ce soir"
    );
  });

  it("extracts citation between straight double quotes", () => {
    const text = '"Votre discours était clair et engageant avec une vraie maîtrise du sujet"';
    expect(extractCitation(text)).toBe(
      "Votre discours était clair et engageant avec une vraie maîtrise du sujet"
    );
  });

  it("returns null when no citation found", () => {
    expect(extractCitation("Pas de citation ici.")).toBeNull();
  });

  it("ignores citations shorter than 20 characters", () => {
    expect(extractCitation("«Trop court»")).toBeNull();
  });
});

describe("extractSynthese", () => {
  it("returns null for falsy inputs", () => {
    expect(extractSynthese("")).toBeNull();
    expect(extractSynthese(null)).toBeNull();
  });

  it("extracts line immediately after the score line", () => {
    const text =
      "Score global : 75%\nUne très belle prestation avec une maîtrise des fondamentaux.";
    expect(extractSynthese(text)).toBe(
      "Une très belle prestation avec une maîtrise des fondamentaux."
    );
  });

  it("strips markdown bold markers from the synthesis line", () => {
    const text = "Score global : 75%\n**Excellent travail sur la gestuelle.**";
    expect(extractSynthese(text)).toBe("Excellent travail sur la gestuelle.");
  });

  it("skips empty lines and separator lines after score", () => {
    const text = "Score global : 75%\n\n---\nTrès bonne maîtrise du rythme et de la diction.";
    expect(extractSynthese(text)).toBe("Très bonne maîtrise du rythme et de la diction.");
  });

  it("returns null when no score line found", () => {
    expect(extractSynthese("Bonne prestation sans ligne de score.")).toBeNull();
  });
});

describe("fmtTime", () => {
  it("formats zero as '0:00'", () => {
    expect(fmtTime(0)).toBe("0:00");
  });

  it("pads single-digit seconds", () => {
    expect(fmtTime(5)).toBe("0:05");
  });

  it("formats seconds below 60", () => {
    expect(fmtTime(45)).toBe("0:45");
  });

  it("formats minutes and seconds", () => {
    expect(fmtTime(125)).toBe("2:05");
  });

  it("formats exactly 60 seconds as '1:00'", () => {
    expect(fmtTime(60)).toBe("1:00");
  });
});
