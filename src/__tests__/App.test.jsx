import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import App from "../../NicolasIA.jsx";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(false);
});

describe("App — écran de login", () => {
  it("affiche le formulaire de connexion au premier rendu", () => {
    render(<App />);
    expect(screen.getByPlaceholderText("vous@exemple.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Minimum 4 caractères")).toBeInTheDocument();
  });

  it("affiche une erreur si les champs sont vides", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    expect(screen.getByText("Email et mot de passe requis.")).toBeInTheDocument();
  });

  it("affiche une erreur si seul l'email est rempli", () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("vous@exemple.com"), {
      target: { value: "test@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    expect(screen.getByText("Email et mot de passe requis.")).toBeInTheDocument();
  });

  it("affiche le message d'erreur retourné par l'API", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Identifiants incorrects." }),
    });
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("vous@exemple.com"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Minimum 4 caractères"), {
      target: { value: "mauvais" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() =>
      expect(screen.getByText("Identifiants incorrects.")).toBeInTheDocument()
    );
  });

  it("affiche une erreur générique en cas d'échec réseau", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("vous@exemple.com"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Minimum 4 caractères"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));
    await waitFor(() =>
      expect(
        screen.getByText("Erreur de connexion.")
      ).toBeInTheDocument()
    );
  });

  it("passe à l'écran de bienvenue après un login réussi", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "mock-jwt-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, email: "test@test.com", role: "user" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("vous@exemple.com"), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Minimum 4 caractères"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /bienvenue/i })).toBeInTheDocument()
    );
    expect(localStorage.getItem("nicolas-ia-token")).toBe("mock-jwt-token");
  });

  it("stocke le token JWT dans localStorage après login réussi", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "abc123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 2, email: "user@example.com", role: "user" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText("vous@exemple.com"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Minimum 4 caractères"), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() =>
      expect(localStorage.getItem("nicolas-ia-token")).toBe("abc123")
    );
  });

});

describe("App — restauration de session", () => {
  it("restaure la session si un token valide est en localStorage", async () => {
    localStorage.setItem("nicolas-ia-token", "existing-token");
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, email: "stored@test.com", role: "user" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] });

    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /bienvenue/i })).toBeInTheDocument()
    );
  });

  it("supprime le token et reste sur login si /auth/me échoue", async () => {
    localStorage.setItem("nicolas-ia-token", "invalid-token");
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<App />);
    await waitFor(() =>
      expect(localStorage.getItem("nicolas-ia-token")).toBeNull()
    );
    expect(screen.getByPlaceholderText("vous@exemple.com")).toBeInTheDocument();
  });
});
