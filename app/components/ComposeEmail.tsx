// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Dialog, Input, Text } from "@cloudflare/kumo";
import { FloppyDiskIcon, PaperPlaneTiltIcon, RobotIcon } from "@phosphor-icons/react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import { stripHtml } from "~/lib/utils";
import RichTextEditor from "./RichTextEditor";
import { useUIStore } from "~/hooks/useUIStore";

export default function ComposeEmail() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	
	const { isComposeModalOpen, closeComposeModal } = useUIStore();

	const {
		to,
		setTo,
		cc,
		setCc,
		bcc,
		setBcc,
		showCcBcc,
		setShowCcBcc,
		subject,
		setSubject,
		body,
		setBody,
		error,
		draftPreview,
		generateDraftError,
		canGenerateDraft,
		isGeneratingDraft,
		isSavingDraft,
		isSending,
		formTitle,
		handleGenerateDraftPreview,
		handleApplyDraftPreview,
		handleDismissDraftPreview,
		handleSaveDraft,
		handleSend,
	} = useComposeForm(mailboxId, folder);

	return (
		<Dialog.Root
			open={isComposeModalOpen}
			onOpenChange={(open) => !open && !isSending && closeComposeModal()}
		>
			<Dialog size="lg" className="p-6 max-h-[85vh] overflow-y-auto">
				<div className="mb-5 flex items-center justify-between gap-3">
					<Dialog.Title className="text-lg font-semibold">
						{formTitle}
					</Dialog.Title>
					{canGenerateDraft && (
						<Button
							type="button"
							variant="secondary"
							size="sm"
							icon={<RobotIcon size={14} />}
							loading={isGeneratingDraft}
							disabled={isSending || isGeneratingDraft}
							onClick={handleGenerateDraftPreview}
						>
							{isGeneratingDraft ? "Generating..." : "Generate Draft"}
						</Button>
					)}
				</div>
				<form onSubmit={(e) => handleSend(e, closeComposeModal)} className="space-y-4">
					{error && <Banner variant="error" text={error} />}
					{generateDraftError && <Banner variant="error" text={generateDraftError} />}
					<div className="flex items-center gap-2">
						<div className="flex-1">
							<Input
								label="To"
								type="text"
								placeholder="recipient@example.com, another@example.com"
								size="sm"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								required
							/>
						</div>
						{!showCcBcc && (
							<button
								type="button"
								onClick={() => setShowCcBcc(true)}
								className="shrink-0 text-xs text-kumo-link hover:text-kumo-link-hover font-medium mt-5"
							>
								CC / BCC
							</button>
						)}
					</div>
					{showCcBcc && (
						<Input
							label="CC"
							type="text"
							size="sm"
							value={cc}
							onChange={(e) => setCc(e.target.value)}
							placeholder="Separate multiple addresses with commas"
						/>
					)}
					{showCcBcc && (
						<Input
							label="BCC"
							type="text"
							size="sm"
							value={bcc}
							onChange={(e) => setBcc(e.target.value)}
							placeholder="Separate multiple addresses with commas"
						/>
					)}
					<Input
						label="Subject"
						type="text"
						placeholder="Email subject"
						size="sm"
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
						required
					/>
					<div>
						<Text size="sm" DANGEROUS_className="font-medium mb-1.5 block">
							Message
						</Text>
						<RichTextEditor value={body} onChange={setBody} />
					</div>
					{draftPreview && (
						<div className="rounded-lg border border-kumo-line bg-kumo-elevated p-4 space-y-3">
							<div>
								<div className="text-sm font-medium text-kumo-default">AI draft preview</div>
								<p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-kumo-strong">
									{stripHtml(draftPreview)}
								</p>
							</div>
							<div className="flex items-center justify-end gap-2">
								<Button type="button" variant="ghost" size="sm" onClick={handleDismissDraftPreview}>
									Dismiss
								</Button>
								<Button type="button" variant="primary" size="sm" onClick={handleApplyDraftPreview}>
									Apply to message
								</Button>
							</div>
						</div>
					)}
					<div className="flex justify-between items-center pt-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={closeComposeModal}
							disabled={isSending}
						>
							Discard
						</Button>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								loading={isSavingDraft}
								disabled={isSending}
								icon={<FloppyDiskIcon size={14} />}
								onClick={handleSaveDraft}
							>
								{isSavingDraft ? "Saving..." : "Save as Draft"}
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isSending}
								disabled={isSavingDraft || isSending}
								icon={<PaperPlaneTiltIcon size={14} />}
							>
								{isSending ? "Sending..." : "Send"}
							</Button>
						</div>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
