import { useState } from 'react'
import { db, writeError } from '../db.ts'
import { dateTime, inputDateToIso, localDateTime } from '../format.ts'
import { numberOrNull } from '../form-values.ts'
import { PROVIDER_IDS, UNITS, type BillingType, type ModelPrice, type Period, type ProviderId, type ProviderRecord, type Unit } from '../types.ts'

const UNIT_LABEL: Record<Unit, string> = { usd: 'USD', credits: 'Credits', percent: 'Percent', requests: 'Requests' }
const PRICE_FIELDS = [
  { key: 'inputPerMillion', label: 'Input / million USD' },
  { key: 'outputPerMillion', label: 'Output / million USD' },
  { key: 'cacheReadPerMillion', label: 'Cache read / million USD' },
  { key: 'cacheWritePerMillion', label: 'Cache write / million USD' },
] as const

function PriceEditor({ price, id, providerId, onSaved, onRemoved }: {
  price?: ModelPrice; id: string; providerId: ProviderId; onSaved: (id: string) => void; onRemoved: (id: string) => void;
}) {
  const [modelId, setModelId] = useState(price?.modelId ?? '')
  const [note, setNote] = useState(price?.note ?? '')
  const [rates, setRates] = useState({
    inputPerMillion: price?.inputPerMillion?.toString() ?? '', outputPerMillion: price?.outputPerMillion?.toString() ?? '',
    cacheReadPerMillion: price?.cacheReadPerMillion?.toString() ?? '', cacheWritePerMillion: price?.cacheWritePerMillion?.toString() ?? '',
  })
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  return <form className="card stack" aria-label={`Price ${price?.modelId ?? 'new'}`} noValidate onSubmit={async event => {
    event.preventDefault(); setError(''); setNotice('')
    if (!modelId.trim()) { setError('Model id is required.'); return }
    let values: Pick<ModelPrice, (typeof PRICE_FIELDS)[number]['key']>
    try { values = { inputPerMillion: numberOrNull(rates.inputPerMillion), outputPerMillion: numberOrNull(rates.outputPerMillion), cacheReadPerMillion: numberOrNull(rates.cacheReadPerMillion), cacheWritePerMillion: numberOrNull(rates.cacheWritePerMillion) } }
    catch (failure) { setError((failure as Error).message); return }
    setBusy(true)
    try { await db.prices.put({ id, providerId, modelId: modelId.trim(), ...values, currency: 'USD', note }); onSaved(id); setNotice('Price saved.') }
    catch (failure) { setError(writeError(failure)) }
    finally { setBusy(false) }
  }}>
    <label><span>Model id</span><input className="model-id" required value={modelId} onChange={event => setModelId(event.target.value)} /></label>
    <div className="form-grid">{PRICE_FIELDS.map(field => <label key={field.key}><span>{field.label}</span><input inputMode="decimal" value={rates[field.key]} onChange={event => setRates(current => ({ ...current, [field.key]: event.target.value }))} /></label>)}</div>
    <label><span>Note</span><textarea value={note} onChange={event => setNote(event.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success-note" role="status">{notice}</p>}
    <div className="actions"><button type="submit" disabled={busy}>Save</button><button type="button" className="quiet" disabled={busy} onClick={async () => {
      setBusy(true); setError('')
      try { if (price) await db.prices.delete(id); onRemoved(id) }
      catch (failure) { setError(writeError(failure)) }
      finally { setBusy(false) }
    }}>Remove</button></div>
  </form>
}

function ProviderCard({ provider, prices }: { provider: ProviderRecord; prices: ModelPrice[] }) {
  const [draft, setDraft] = useState({
    billingType: provider.billingType, allowanceAmount: provider.allowanceAmount?.toString() ?? '', allowanceUnit: provider.allowanceUnit ?? '',
    allowancePeriod: provider.allowancePeriod ?? '', remainingAmount: provider.remainingAmount?.toString() ?? '', remainingUnit: provider.remainingUnit ?? '',
    reset: provider.resetAt ? localDateTime(new Date(provider.resetAt)) : '', notes: provider.notes,
  })
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  const [newIds, setNewIds] = useState<string[]>([])
  const update = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }))
  const clearDraft = (id: string) => setNewIds(current => current.filter(value => value !== id))
  return <section className="card stack" aria-label={provider.label}>
    <h2>{provider.label}</h2>
    <form className="stack" aria-label={`${provider.label} allowance`} noValidate onSubmit={async event => {
      event.preventDefault(); setError(''); setNotice('')
      let allowanceAmount: number | null, remainingAmount: number | null
      try { allowanceAmount = numberOrNull(draft.allowanceAmount); remainingAmount = numberOrNull(draft.remainingAmount) }
      catch (failure) { setError((failure as Error).message); return }
      const resetAt = draft.reset ? inputDateToIso(draft.reset) : null
      const resetInput = event.currentTarget.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
      if (resetInput.validity.badInput || (draft.reset && resetAt === null)) { setError('Reset time is not a valid date.'); return }
      const remainingUnit = draft.remainingUnit as Unit || null
      const remainingChanged = remainingAmount !== provider.remainingAmount || remainingUnit !== provider.remainingUnit
      setBusy(true)
      try {
        await db.providers.put({ ...provider, billingType: draft.billingType as BillingType, allowanceAmount,
          allowanceUnit: draft.allowanceUnit as Unit || null, allowancePeriod: draft.allowancePeriod as Period || null,
          remainingAmount, remainingUnit, resetAt, notes: draft.notes,
          remainingUpdatedAt: remainingChanged ? new Date().toISOString() : provider.remainingUpdatedAt,
        })
        setNotice('Saved.')
      } catch (failure) { setError(writeError(failure)) }
      finally { setBusy(false) }
    }}>
      <label><span>Billing type</span><select value={draft.billingType} onChange={event => update('billingType', event.target.value)}><option value="api">API</option><option value="subscription">Subscription</option></select></label>
      <div className="form-grid">
        <label><span>Allowance amount</span><input inputMode="decimal" value={draft.allowanceAmount} onChange={event => update('allowanceAmount', event.target.value)} /></label>
        <label><span>Unit</span><select value={draft.allowanceUnit} onChange={event => update('allowanceUnit', event.target.value)}><option value="">—</option>{UNITS.map(unit => <option key={unit} value={unit}>{UNIT_LABEL[unit]}</option>)}</select></label>
        <label className="full"><span>Period</span><select value={draft.allowancePeriod} onChange={event => update('allowancePeriod', event.target.value)}><option value="">—</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
        <label><span>Remaining amount</span><input inputMode="decimal" value={draft.remainingAmount} onChange={event => update('remainingAmount', event.target.value)} />{provider.remainingUpdatedAt && <small>Updated {dateTime(provider.remainingUpdatedAt)}</small>}</label>
        <label><span>Remaining unit</span><select value={draft.remainingUnit} onChange={event => update('remainingUnit', event.target.value)}><option value="">—</option>{UNITS.map(unit => <option key={unit} value={unit}>{UNIT_LABEL[unit]}</option>)}</select></label>
        <label className="full"><span>Reset</span><input type="datetime-local" value={draft.reset} onChange={event => update('reset', event.target.value)} /></label>
        <label className="full"><span>Notes</span><textarea value={draft.notes} onChange={event => update('notes', event.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success-note" role="status">{notice}</p>}
      <div><button className="primary" type="submit" disabled={busy}>Save</button></div>
    </form>
    <div className="divider stack"><div className="row"><h3>Prices</h3><button onClick={() => setNewIds(current => [...current, crypto.randomUUID()])}>Add price</button></div>
      {prices.map(price => <PriceEditor key={price.id} id={price.id} providerId={provider.id} price={price} onSaved={clearDraft} onRemoved={clearDraft} />)}
      {newIds.filter(id => !prices.some(price => price.id === id)).map(id => <PriceEditor key={id} id={id} providerId={provider.id} onSaved={clearDraft} onRemoved={clearDraft} />)}
    </div>
  </section>
}

export function Models({ providers, prices }: { providers: ProviderRecord[]; prices: ModelPrice[] }) {
  return <><div className="page-header"><h1>Models</h1></div><div className="stack">
    {PROVIDER_IDS.map(id => {
      const provider = providers.find(provider => provider.id === id)
      return provider && <ProviderCard key={id} provider={provider} prices={prices.filter(price => price.providerId === id)} />
    })}
  </div></>
}
