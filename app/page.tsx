import Header from "@/components/header/Header";
import Hero from "@/components/hero/Hero";
import HowItWorks from "@/components/how-it-works/HowItWorks";
import Footer from "@/components/footer/Footer";

export default function Home() {
	return (
		<>
			<a className="skip-link" href="#main">Skip to content</a>
			<div className="page-shell">
				<Header />
				<main id="main" tabIndex={-1}>
					<Hero />
					<HowItWorks />
				</main>
				<Footer />
			</div>
		</>
	);
}
