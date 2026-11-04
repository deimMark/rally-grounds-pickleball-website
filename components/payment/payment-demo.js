'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, ImageUp, ShieldAlert, Trash2, RefreshCw, Info, Wallet } from 'lucide-react';
import { DemoBadge } from '@/components/ui/demo-notice';
import { formatMoney } from '@/lib/domain/demo-availability';
import { demoDayLabel } from '@/lib/demo/booking';
import { paymentDemo, paymentStates, acceptedMimeTypes, formatBytes, formatManila } from '@/lib/demo/payment';
import { inspectReceiptFile, errorMessages } from '@/lib/browser/receipt-image';

const acceptAttribute = acceptedMimeTypes.join(',');

export function PaymentDemo({ context, query }) {
 const { selection, receipt, initialState } = context;
 const ids = { file: useId(), help: useId(), error: useId(), method: useId(), outcome: useId() };
 const input = useRef(null), heading = useRef(null);
 const [method, setMethod] = useState('gcash');
 const [image, setImage] = useState(null);
 const [error, setErrorState] = useState('');
 const [errorNonce, setErrorNonce] = useState(0);
 const setError = (message) => { setErrorState(message); if (message) setErrorNonce((n) => n + 1); };
 const [checking, setChecking] = useState(false);
 const [state, setState] = useState(initialState);
 const [announcement, setAnnouncement] = useState('');
 const [outcome, setOutcome] = useState('');
 const expired = initialState === 'expired';
 const submitted = state === 'pending_review';
 const chosenMethod = paymentDemo.methods.find((entry) => entry.id === method);
 const current = paymentStates[state];
 const previewState = outcome ? paymentStates[outcome] : null;
 const sessionLabel = `${selection.slot.label} – ${selection.slot.endLabel}`;

 // Release the temporary preview URL when the image changes or the page unmounts.
 useEffect(() => () => { if (image?.url) URL.revokeObjectURL(image.url); }, [image]);
 // Move focus to the file input after a validation error, once it is enabled again.
 useEffect(() => { if (errorNonce) input.current?.focus(); }, [errorNonce]);

 function clearImage(reason) {
  setImage(null);
  if (input.current) input.current.value = '';
  if (reason) setAnnouncement(reason);
 }
 async function onFile(event) {
  const file = event.target.files?.[0];
  setError('');
  if (!file) { clearImage(''); return; }
  setChecking(true);
  const result = await inspectReceiptFile(file);
  setChecking(false);
  if (!result.ok) {
   clearImage('');
   setError(result.message);
   setAnnouncement('');
   return;
  }
  setImage(result);
  setAnnouncement(`Sample receipt ${result.name} is ready to preview. ${result.label}, ${result.sizeLabel}. Nothing has been uploaded.`);
 }
 function submit(event) {
  event.preventDefault();
  if (expired || submitted) return;
  if (!image) { setError(errorMessages.empty); return; }
  setError('');
  setState('pending_review');
  setAnnouncement('Demo receipt submitted. Awaiting staff verification in this demonstration. No payment has been verified and no real receipt was uploaded.');
  setTimeout(() => heading.current?.focus(), 0);
 }
 function startOver() {
  clearImage('');
  setState(initialState);
  setOutcome('');
  setAnnouncement('Demo reset. No receipt is selected.');
 }

 return <main id="main-content" className="booking-page payment-page"><div className="container booking-result-wrap">
  <Link href={`/booking/confirmation?${query}`} className="text-link booking-back"><ArrowLeft size={16} aria-hidden="true" />Back to demo confirmation</Link>
  <div className="booking-result-heading"><span className="booking-result-icon"><Wallet size={29} aria-hidden="true" /></span><DemoBadge>DEMONSTRATION ONLY</DemoBadge><h1>Pay, then show us the receipt.</h1><p>A preview of how a customer would submit a GCash or bank-transfer receipt for staff review. No payment is collected here.</p></div>
  <section className="booking-meaning" aria-labelledby="payment-meaning"><h2 id="payment-meaning" className="sr-only">What this page is and is not</h2><dl><div><dt>This page is</dt><dd>a demonstration of selecting and previewing a receipt image. The image stays in your browser’s memory and is never uploaded.</dd></div><div><dt>This page is not</dt><dd>a payment, a transfer destination or proof that money was received. Only staff checking the club’s real account records could ever verify a payment.</dd></div></dl></section>

  <div className="booking-grid booking-result-grid">
   <section className="booking-panel" aria-labelledby="payment-heading">
    <h2 id="payment-heading" ref={heading} tabIndex={-1} className="payment-heading">Sample booking to pay for</h2>
    <dl className="booking-receipt"><div><dt>Demo reference</dt><dd>{receipt.reference}</dd></div><div><dt>Court and session</dt><dd>Court {selection.court.number}<br />{demoDayLabel(selection.day.id)}<br />{sessionLabel} <span className="booking-tz">Asia/Manila</span></dd></div><div><dt>Frozen sample total</dt><dd><span className="payment-amount">{formatMoney(receipt.totalCentavos)}</span> <span className="sr-only">Philippine pesos</span></dd></div><div><dt>Booking status</dt><dd>{expired ? 'Sample hold expired' : 'Sample unpaid hold'}</dd></div></dl>
    <p className={`booking-state ${current.tone}`} role="status" aria-live="polite">{current.label}</p>
    <p className="booking-helper">{current.customer}</p>

    {expired ? <div className="booking-safe-note"><ShieldAlert size={20} aria-hidden="true" /><p>This sample booking expired before any payment was verified. A receipt cannot be submitted for it and would not revive the reservation. In the real product the customer would start a new booking.</p></div> : submitted ? <>
     <div className="payment-submitted" role="group" aria-label="Demo submission result"><h3>{paymentStates.pending_review.label}</h3><p><strong>No payment has been verified. No real receipt was uploaded.</strong></p><p>In the real product, staff would now compare this receipt with the club’s actual GCash or bank records. Your booking would stay an unpaid hold until a matching incoming transaction is found. Submitting a receipt does not extend the hold.</p>{image && <figure className="payment-preview">
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory blob URL, never a served asset */}
      <img src={image.url} alt={`Preview of the selected sample receipt image ${image.name}`} /><figcaption>{image.name} · {image.label} · {image.sizeLabel} · {image.width}×{image.height}px · held in browser memory only</figcaption></figure>}</div>
     <button type="button" className="text-link booking-back" onClick={startOver}><RefreshCw size={15} aria-hidden="true" />Start the demo again</button>
    </> : <form onSubmit={submit} noValidate>
     <fieldset className="payment-methods"><legend id={ids.method}>Payment method</legend>
      {paymentDemo.methods.map((entry) => <label key={entry.id} className={`payment-method ${method === entry.id ? 'chosen' : ''}`}><input type="radio" name="method" value={entry.id} checked={method === entry.id} onChange={() => setMethod(entry.id)} /><span>{entry.label}</span><small>Pay in {entry.app}</small></label>)}
     </fieldset>
     <section className="payment-instructions" aria-labelledby="instructions-heading"><h3 id="instructions-heading">How you would pay with {chosenMethod.label}</h3>
      <div className="payment-recipient"><DemoBadge>{paymentDemo.recipient.badge}</DemoBadge><strong>{paymentDemo.recipient.name}</strong><p>{paymentDemo.recipient.note}</p></div>
      <ol>{chosenMethod.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p className="booking-helper">Then submit the receipt image below so staff can review it. Submitting a receipt is a claim; it is not proof that the club received the money, and this demonstration collects no payment at all.</p>
     </section>

     <div className={`payment-file-field ${error ? 'invalid' : ''}`}>
      <label htmlFor={ids.file} className="field-label">Receipt image (sample only)</label>
      <p id={ids.help} className="booking-helper">Choose a <strong>synthetic sample image</strong>, for example a screenshot you made for this demo. Do not select a real receipt. PNG, JPEG or WebP, up to {formatBytes(paymentDemo.image.maxBytes)}. The file is checked and previewed in your browser only.</p>
      <input ref={input} id={ids.file} type="file" accept={acceptAttribute} aria-describedby={error ? `${ids.help} ${ids.error}` : ids.help} aria-invalid={error ? 'true' : undefined} onChange={onFile} disabled={checking} />
      {error && <p id={ids.error} className="booking-error" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</p>}
     </div>

     {image ? <figure className="payment-preview">
      {/* eslint-disable-next-line @next/next/no-img-element -- in-memory blob URL, never a served asset */}
      <img src={image.url} alt={`Preview of the selected sample receipt image ${image.name}`} /><figcaption><span><strong>{image.name}</strong></span><span>{image.label} · {image.sizeLabel} · {image.width}×{image.height}px</span><span>Held in browser memory only. Not uploaded.</span></figcaption>
      <div className="payment-preview-actions"><button type="button" className="button button-outline" onClick={() => input.current?.click()}><ImageUp size={16} aria-hidden="true" />Replace image</button><button type="button" className="button button-outline" onClick={() => clearImage('Selected image removed. No receipt is selected.')}><Trash2 size={16} aria-hidden="true" />Remove image</button></div></figure>
     : <p className="payment-empty"><Info size={16} aria-hidden="true" />No receipt image selected yet.</p>}

     <div className="booking-terms"><h3>What happens when a real receipt is submitted</h3><p>In the live product the image would be stored privately for staff only, the booking would stay an unpaid hold, and staff would compare the receipt with the club’s own GCash or bank records. Only a matching incoming transaction could lead to a verified payment. Deadlines, fees and refund terms still need owner approval and are not shown here.</p></div>
     <button className="button button-navy booking-next" type="submit" disabled={checking}>Submit demo receipt <ArrowRight size={17} aria-hidden="true" /></button>
     <p className="booking-helper">Creates a fictional “awaiting staff verification” state on this page only. Nothing is sent anywhere.</p>
    </form>}
    <div role="status" aria-live="polite" className="payment-announcer">{announcement}</div>
   </section>

   <aside className="booking-summary" aria-label="Demo outcomes and safeguards"><ShieldAlert size={24} aria-hidden="true" /><h2>A receipt is a claim, not a payment.</h2><p>Staff must find the matching transaction in the club’s real GCash or bank account before anything is marked verified. Screenshots can be edited; account records cannot.</p>
    <label className="field-label" htmlFor={ids.outcome}>Preview a demo outcome</label>
    <select id={ids.outcome} value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">Choose a sample outcome</option><option value="needs_resubmission">Receipt rejected</option><option value="verified">Payment verified (fictional)</option><option value="expired">Booking expired</option></select>
    {previewState && <div className={`payment-outcome ${previewState.tone}`} role="group" aria-label="Sample outcome preview"><span className={`booking-state ${previewState.tone}`}>{previewState.label}</span><p>{previewState.customer}</p>{outcome === 'verified' && <p className="booking-helper">Fictional example. This demonstration cannot verify a payment and no money was received.</p>}</div>}
    <div className="booking-terms"><h3>Not in this demo</h3><p>Real recipient details, uploads, deadlines, partial payments, refunds and notifications. Each needs owner approval first.</p></div>
    <Link href={`/booking/status?${query}`} className="text-link booking-back">View the demo private status <ArrowRight size={15} aria-hidden="true" /></Link>
    <p className="booking-helper">Sample times shown in Asia/Manila. Evidence sample timestamp: {formatManila(paymentDemo.submittedAt)}.</p>
   </aside>
  </div>
 </div></main>;
}
