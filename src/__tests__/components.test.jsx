import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MicBanner, AnalyzingScreen, GlobalScoreBanner } from "../../NicolasIA.jsx";

describe("MicBanner", () => {
  it("renders the advice message initially", () => {
    render(<MicBanner isMobile={false} />);
    expect(screen.getByText(/écouteurs avec micro/i)).toBeInTheDocument();
  });

  it("disappears when the dismiss button is clicked", () => {
    const { container } = render(<MicBanner isMobile={false} />);
    fireEvent.click(container.querySelector("button"));
    expect(screen.queryByText(/écouteurs avec micro/i)).not.toBeInTheDocument();
  });

  it("renders on mobile without errors", () => {
    render(<MicBanner isMobile={true} />);
    expect(screen.getByText(/équipez-vous avant de commencer/i)).toBeInTheDocument();
  });
});

describe("AnalyzingScreen", () => {
  it("renders all 4 analysis steps", () => {
    render(<AnalyzingScreen isMobile={false} />);
    expect(screen.getByText("Transcription du discours")).toBeInTheDocument();
    expect(screen.getByText("Analyse du langage non-verbal")).toBeInTheDocument();
    expect(screen.getByText("Évaluation rhétorique")).toBeInTheDocument();
    expect(screen.getByText("Génération du rapport")).toBeInTheDocument();
  });

  it("renders the main title", () => {
    render(<AnalyzingScreen isMobile={false} />);
    expect(screen.getByText(/nicolas analyse votre prestation/i)).toBeInTheDocument();
  });

  it("renders on mobile without errors", () => {
    render(<AnalyzingScreen isMobile={true} />);
    expect(screen.getByText("Transcription du discours")).toBeInTheDocument();
  });
});

describe("GlobalScoreBanner", () => {
  it("renders nothing when score is null", () => {
    const { container } = render(<GlobalScoreBanner score={null} isMobile={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when score is undefined", () => {
    const { container } = render(<GlobalScoreBanner score={undefined} isMobile={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the score percentage", () => {
    render(<GlobalScoreBanner score={75} isMobile={false} />);
    expect(screen.getByText("75")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("shows 'Performance exceptionnelle' for score >= 90", () => {
    render(<GlobalScoreBanner score={92} isMobile={false} />);
    expect(screen.getByText("Performance exceptionnelle")).toBeInTheDocument();
  });

  it("shows 'Très belle prestation' for score 75–89", () => {
    render(<GlobalScoreBanner score={80} isMobile={false} />);
    expect(screen.getByText("Très belle prestation")).toBeInTheDocument();
  });

  it("shows 'Bonne prestation à enrichir' for score 60–74", () => {
    render(<GlobalScoreBanner score={65} isMobile={false} />);
    expect(screen.getByText("Bonne prestation à enrichir")).toBeInTheDocument();
  });

  it("shows 'Socle correct, axes de progrès' for score 45–59", () => {
    render(<GlobalScoreBanner score={50} isMobile={false} />);
    expect(screen.getByText("Socle correct, axes de progrès")).toBeInTheDocument();
  });

  it("shows 'Plusieurs leviers à activer' for score 30–44", () => {
    render(<GlobalScoreBanner score={35} isMobile={false} />);
    expect(screen.getByText("Plusieurs leviers à activer")).toBeInTheDocument();
  });

  it("shows 'À reconstruire ensemble' for score < 30", () => {
    render(<GlobalScoreBanner score={20} isMobile={false} />);
    expect(screen.getByText("À reconstruire ensemble")).toBeInTheDocument();
  });

  it("renders the syntheseLine when provided", () => {
    render(<GlobalScoreBanner score={75} syntheseLine="Excellente maîtrise du sujet !" isMobile={false} />);
    expect(screen.getByText("Excellente maîtrise du sujet !")).toBeInTheDocument();
  });

  it("renders on mobile without errors", () => {
    render(<GlobalScoreBanner score={60} isMobile={true} />);
    expect(screen.getByText("60")).toBeInTheDocument();
  });
});
