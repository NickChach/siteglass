import { useState } from "react";
import styles from "./website-check-form.module.css";

type WebsiteCheckFormProps = {
	submitWebsite: (formData: FormData) => void;
	pending: boolean;
	invalidAddress: boolean;
};

export default function WebsiteCheckForm({ submitWebsite, pending, invalidAddress }: WebsiteCheckFormProps) {
	const [website, setWebsite] = useState("");

	return (
		<form id="website-check" className={styles.form} action={submitWebsite} aria-busy={pending}>
			<label htmlFor="website-url">Website address</label>
			<div className={styles.urlField}>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="12" r="9" />
					<ellipse cx="12" cy="12" rx="4" ry="9" />
					<path d="M3 12h18" />
				</svg>
				<input
					id="website-url"
					name="website"
					value={website}
					type="text"
					inputMode="url"
					placeholder="yourwebsite.com"
					autoComplete="url"
					autoCapitalize="none"
					spellCheck={false}
					aria-invalid={invalidAddress || undefined}
					aria-describedby={invalidAddress ? "website-check-error" : "url-hint"}
					onChange={(event) => setWebsite(event.currentTarget.value)}
					readOnly={pending}
					required
				/>
			</div>
			<button className={styles.button} type="submit" disabled={pending}>
				{pending ? "Checking your website…" : "Check my website"}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="10.5" cy="10.5" r="6.5" />
					<path d="m15.5 15.5 5 5" />
				</svg>
			</button>
			<p className={styles.hint} id="url-hint">
				One link. No account needed.
			</p>
		</form>
	);
}
