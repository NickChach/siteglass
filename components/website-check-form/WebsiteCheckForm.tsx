"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import styles from "./website-check-form.module.css";

export default function WebsiteCheckForm() {
	const inputRef = useRef<HTMLInputElement>(null);
	const [feedback, setFeedback] = useState("");

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = inputRef.current;
		if (!input) return;

		try {
			const address = new URL(input.value);
			if (!["http:", "https:"].includes(address.protocol) || !address.hostname) {
				throw new Error("Unsupported website address");
			}
		} catch {
			input.setCustomValidity("Enter a website address starting with http:// or https://.");
			input.reportValidity();
			return;
		}

		setFeedback("Website scanning is not connected yet. No check has been performed.");
	}

	function handleChange() {
		inputRef.current?.setCustomValidity("");
		setFeedback("");
	}

	return (
		<form id="website-check" className={styles.form} onSubmit={handleSubmit}>
			<label htmlFor="website-url">Website address</label>
			<section className={styles.urlField}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<ellipse cx="12" cy="12" rx="4" ry="9" />
					<path d="M3 12h18" />
				</svg>
				<input
					ref={inputRef}
					id="website-url"
					name="website"
					type="url"
					inputMode="url"
					placeholder="https://yourwebsite.com"
					autoComplete="url"
					autoCapitalize="none"
					spellCheck={false}
					aria-describedby="url-hint"
					onChange={handleChange}
					required
				/>
			</section>
			<button className={styles.button} type="submit">
				Check my website
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="10.5" cy="10.5" r="6.5" />
					<path d="m15.5 15.5 5 5" />
				</svg>
			</button>
			<p className={styles.hint} id="url-hint">
				One link. No account needed.
			</p>
			<div role="status" aria-atomic="true">
				{feedback && <p className={styles.feedback}>{feedback}</p>}
			</div>
		</form>
	);
}
