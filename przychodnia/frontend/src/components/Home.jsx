import React from "react";
import "./Home.css";
import logo from "../assets/logo.png";

export default function Home() {
    return (
        <div className="home">
            {/* 🔹 Sekcja nagłówka */}
            <header className="header">
                <img
                    src={logo}
                    alt="Logo przychodni"
                    style={{ width: "230px", height: "auto" }}
                />
                <div>
                    <h1>„Twój zdrowy uśmiech”</h1>
                    <p>Gabinet stomatologiczny w Sosnowcu</p>
                </div>
            </header>

            {/* 🔹 Sekcja o szpitalu */}
            <section className="about">
                <h2>O nas</h2>
                <p>
                    W przychodni „Twój zdrowy uśmiech” dbamy o zdrowie, estetykę i komfort naszych pacjentów. Korzystamy z nowoczesnego sprzętu oraz bezbolesnych metod leczenia, zapewniając opiekę zgodną z najnowszymi standardami stomatologii. Nasz zespół doświadczonych specjalistów z troską podchodzi do każdego pacjenta – dorosłego i dziecka – aby każdy mógł cieszyć się zdrowym i pewnym siebie uśmiechem. Z nami uśmiech to przyjemność.
                </p>

            </section>

            {/* 🔹 Sekcja usług */}
            <section className="services">
                <h2>Co nas wyróżnia?</h2>
                <div className="service-list">
                    <div className="service-card">
                        <h3>🏥 Nowoczesny sprzęt</h3>
                        <p>Korzystamy z zaawansowanych technologii, które gwarantują precyzję i skuteczność leczenia.</p>
                    </div>
                    <div className="service-card">
                        <h3>🩺 Bezbolesne zabiegi</h3>
                        <p>Dzięki nowoczesnym metodom oraz delikatnemu podejściu leczenie przebiega komfortowo i bez stresu.</p>
                    </div>
                    <div className="service-card">
                        <h3>💙 Indywidualne podejście</h3>
                        <p>Każdego pacjenta traktujemy ze szczególną troską oraz uwagą, dopasowując leczenie do jego potrzeb i oczekiwań.</p>
                    </div>
                </div>
            </section>

            {/* 🔹 Sekcja kontaktu */}
            <section className="contact">
                <h2>Kontakt</h2>
                <p>📍 ul. Ulicowska 25, Sosnowiec</p>
                <p>✉️ kontakt@zdrowyUsmiech.pl</p>
                <p>📞 123 456 789</p>
            </section>

            {/* 🔹 Stopka */}
            <footer className="footer">
                <p>Zdjęcie użyte w ramach loga pochodzi z Pixabay.</p>
            </footer>
        </div>
    );
}