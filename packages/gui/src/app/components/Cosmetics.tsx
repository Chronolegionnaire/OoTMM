import type { Cosmetics } from '@ootmm/generator';

import { COLORS, COSMETICS } from '@ootmm/generator';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CheckboxField } from './ui/CheckboxField';
import { FileSelectField, SelectField } from './ui';
import {
  configureEquipmentFile,
  defaultTarget,
  inspectEquipmentFile,
  targetsForItem,
  type EquipmentGame,
  type EquipmentInspection,
  type EquipmentRule,
} from './equipment-cosmetic';

import ootmmLogo from '../../assets/logo.png';
import { useStore } from '../store';

const COLOR_OPTIONS: { label: string, value: string }[] = [{ value: 'default', label: 'Default' }, { value: 'auto', label: 'Auto' }, { value: 'random', label: 'Random' }, ...Object.entries(COLORS).map(([key, x]) => ({ label: x.name, value: key }))];

function CosmeticTooltips({ cosmetic }: { cosmetic: string }) {
  const data = COSMETICS.find(x => x.key === cosmetic)!;
  const description = (data as any).description;

  let defaultValue = '';

  if (!description) {
    return null;
  }

  switch (data.type) {
    case 'boolean':
      defaultValue = data.default ? 'true' : 'false';
      break;
    case 'color':
      defaultValue = 'Default';
      break;
  }

  return <>
    <pre className="whitespace-pre-line flex flex-col gap-4">
      {description.split('<br>').join('\n')}
      <span>Default: <strong>{defaultValue}</strong></span>
    </pre>
  </>;
}

function Cosmetic({ cosmetic }: { cosmetic: keyof Cosmetics }) {
  const cosmetics = useStore(state => state.cosmetics);
  const setCosmetic = useStore(state => state.setCosmetic);
  const data = COSMETICS.find(x => x.key === cosmetic)!;

  switch (data.type) {
    case 'color': {
      const selectedColorKey = cosmetics[cosmetic] as string;
      const colorValue = selectedColorKey && selectedColorKey !== 'default' && selectedColorKey !== 'auto' && selectedColorKey !== 'random'
        ? COLORS[selectedColorKey as keyof typeof COLORS]?.value
        : null;

      return (
        <SelectField
          key={cosmetic}
          value={selectedColorKey}
          label={data.name}
          color={colorValue}
          options={COLOR_OPTIONS}
          tooltip={(data as any).description && <CosmeticTooltips cosmetic={cosmetic} />}
          onSelect={v => setCosmetic(cosmetic, v)}
        />
      );
    }
    case 'file':
      return (
        <FileSelectField
          imageSrc={ootmmLogo}
          label={data.name}
          accept={data.ext.split(',').map(ext => `.${ext.trim()}`).join(',')}
          file={cosmetics[cosmetic] as File | null}
          onInput={(f) => setCosmetic(cosmetic, f)}
        />
      );
    case 'boolean':
      return (
        <CheckboxField
          label={data.name}
          checked={!!(cosmetics[cosmetic])}
          tooltip={(data as any).description && <CosmeticTooltips cosmetic={cosmetic} />}
          onChange={(v) => setCosmetic(cosmetic, v)}
        />
      );
    default:
      return null;
  }
}

type Inspected = { inspection?: EquipmentInspection; error?: string };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ruleMap(inspection: EquipmentInspection, game: EquipmentGame) {
  const configured = new Map((inspection.config?.rules ?? []).map((rule) => [rule.sourceId, rule.targetId]));
  const out = new Map<string, string | null>();
  for (const item of inspection.items) {
    out.set(item.sourceId, configured.has(item.sourceId) ? configured.get(item.sourceId)! : defaultTarget(item, game));
  }
  return out;
}

function EquipmentFileRow({
  file,
  globalIndex,
  localIndex,
  localCount,
  game,
  info,
  onRemove,
  onMove,
  onReplace,
}: {
  file: File;
  globalIndex: number;
  localIndex: number;
  localCount: number;
  game: EquipmentGame;
  info?: Inspected;
  onRemove: (globalIndex: number) => void;
  onMove: (localIndex: number, delta: number) => void;
  onReplace: (globalIndex: number, file: File, info: Inspected) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const inspection = info?.inspection;

  const updateRule = async (sourceId: string, value: string | null) => {
    if (!inspection || busy) return;
    setBusy(true);
    setUpdateError(null);
    try {
      const map = ruleMap(inspection, game);
      map.set(sourceId, value);
      const rules: EquipmentRule[] = inspection.items.map((item) => ({
        sourceId: item.sourceId,
        targetId: map.get(item.sourceId) ?? null,
      }));
      const configuredFile = await configureEquipmentFile(file, game, rules);

      const configuredInspection: EquipmentInspection = {
        items: inspection.items,
        config: { version: 1, game, rules },
      };
      onReplace(globalIndex, configuredFile, { inspection: configuredInspection });
    } catch (error) {
      setUpdateError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return <div className="rounded border border-slate-600/50 bg-black/10 p-3 flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate" title={file.name}>{file.name}</div>
        <div className="text-xs opacity-70">#{localIndex + 1} · lower files override higher files</div>
      </div>
      <button type="button" className="px-2 py-1 disabled:opacity-30" disabled={localIndex === 0 || busy} onClick={() => onMove(localIndex, -1)} title="Move up">↑</button>
      <button type="button" className="px-2 py-1 disabled:opacity-30" disabled={localIndex + 1 >= localCount || busy} onClick={() => onMove(localIndex, 1)} title="Move down">↓</button>
      <button type="button" className="px-2 py-1 text-lg" disabled={busy} onClick={() => onRemove(globalIndex)} title="Remove file" aria-label={`Remove ${file.name}`}>×</button>
    </div>

    {info?.error && <div className="text-sm text-red-400">{info.error}</div>}
    {updateError && <div className="text-sm text-red-400">{updateError}</div>}
    {!info?.error && !inspection && <div className="text-sm opacity-70">Inspecting equipment…</div>}
    {inspection && inspection.items.length === 0 && <div className="text-sm text-amber-400">No supported equipment was detected.</div>}

    {inspection?.items.map((item) => {
      const map = ruleMap(inspection, game);
      const targetId = map.get(item.sourceId) ?? null;
      const options = targetsForItem(item, game);
      const enabled = targetId !== null && options.some((option) => option.id === targetId);
      const crossGame = item.nativeGame !== null && item.nativeGame !== game;
      return <div key={item.sourceId} className="rounded bg-black/10 px-3 py-2">
        <div className="flex gap-2 items-start">
          <input
            type="checkbox"
            className="mt-1"
            checked={enabled}
            disabled={busy || options.length === 0}
            onChange={(event) => updateRule(item.sourceId, event.target.checked ? (targetId ?? defaultTarget(item, game)) : null)}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium">{item.label}</div>
            <div className="text-xs opacity-70">
              Detected {item.family}{item.nativeGame ? ` · source ${item.nativeGame.toUpperCase()}` : ''}
              {crossGame ? ' · cross-game mapping' : ''}
            </div>
            {options.length === 0 && <div className="text-xs text-amber-400 mt-1">This non-variant item has no equivalent target in {game.toUpperCase()}.</div>}
          </div>
          {enabled && (item.family === 'sword' || item.family === 'shield') && <label className="flex items-center gap-2 text-sm">
            <span className="opacity-70">Apply to</span>
            <select
              className="bg-inherit border border-slate-500 rounded px-2 py-1"
              value={targetId ?? ''}
              disabled={busy}
              onChange={(event) => updateRule(item.sourceId, event.target.value)}
            >
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>}
        </div>
      </div>;
    })}
  </div>;
}

function EquipmentFilesField({ game, label, cosmeticKey }: { game: EquipmentGame; label: string; cosmeticKey: 'equipmentOot' | 'equipmentMm' }) {
  const cosmetics = useStore(state => state.cosmetics);
  const setCosmetic = useStore(state => state.setCosmetic);
  const value = cosmetics[cosmeticKey];
  const files = useMemo(() => Array.isArray(value) ? value.filter((entry): entry is File => entry instanceof File) : [], [value]);

  const inspectionCache = useRef(new WeakMap<File, Inspected>());
  const inspectionPending = useRef(new WeakSet<File>());
  const mounted = useRef(true);
  const dragDepth = useRef(0);
  const [, forceInspectionRender] = useState(0);
  const [addError, setAddError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    for (const file of files) {
      if (inspectionCache.current.has(file) || inspectionPending.current.has(file)) continue;
      inspectionPending.current.add(file);
      void inspectEquipmentFile(file).then(
        (inspection) => inspectionCache.current.set(file, { inspection }),
        (error) => inspectionCache.current.set(file, { error: errorMessage(error) }),
      ).finally(() => {
        inspectionPending.current.delete(file);
        if (mounted.current) forceInspectionRender((version) => version + 1);
      });
    }
  }, [files]);

  const entries = files.map((file, globalIndex) => ({
    file,
    globalIndex,
    info: inspectionCache.current.get(file),
  }));

  const setFiles = (next: File[]) => setCosmetic(cosmeticKey, next);

  const addFiles = async (incoming: readonly File[]) => {
    if (incoming.length === 0) return;
    setAddError(null);
    const next = [...files];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!/\.(?:pak|zobj)$/i.test(file.name)) {
        errors.push(`${file.name}: only .pak and .zobj equipment files are supported`);
        continue;
      }
      try {
        const configuredFile = await configureEquipmentFile(file, game);
        const inspection = await inspectEquipmentFile(configuredFile);
        inspectionCache.current.set(configuredFile, { inspection });
        next.push(configuredFile);
      } catch (error) {
        errors.push(`${file.name}: ${errorMessage(error)}`);
      }
    }

    if (errors.length) setAddError(errors.join('\n'));
    setFiles(next);
    forceInspectionRender((version) => version + 1);
  };

  const replace = (globalIndex: number, file: File, info: Inspected) => {
    inspectionCache.current.set(file, info);
    const next = [...files];
    next[globalIndex] = file;
    setFiles(next);
    forceInspectionRender((version) => version + 1);
  };

  const move = (localIndex: number, delta: number) => {
    const other = localIndex + delta;
    if (other < 0 || other >= entries.length) return;
    const a = entries[localIndex].globalIndex;
    const b = entries[other].globalIndex;
    const next = [...files];
    [next[a], next[b]] = [next[b], next[a]];
    setFiles(next);
  };

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    void addFiles(Array.from(event.dataTransfer.files));
  };

  return <section className="rounded-lg border border-slate-500/40 p-4 flex flex-col gap-4">
    <div>
      <h2 className="text-xl font-semibold">{label}</h2>
      <p className="text-sm opacity-70 mt-1">Add .pak or .zobj files. Select individual detected items. Sword/shield assets can be redirected to any {game.toUpperCase()} sword/shield variant. Conflict resolution is top → bottom; lower files win after remapping.</p>
    </div>

    <div
      className={`rounded border border-dashed px-4 py-5 text-center transition-colors ${dragActive ? 'border-slate-300 bg-white/10' : 'border-slate-500/60 bg-black/5'}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="text-sm mb-2">Drop .pak or .zobj files here</div>
      <label className="inline-flex cursor-pointer rounded border border-slate-500 px-3 py-2 hover:bg-white/5">
        <span>Choose equipment files</span>
        <input
          className="hidden"
          type="file"
          accept=".pak,.zobj"
          multiple
          onChange={(event) => {
            void addFiles(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = '';
          }}
        />
      </label>
    </div>

    {addError && <pre className="whitespace-pre-wrap text-sm text-red-400">{addError}</pre>}
    {entries.length === 0 && <div className="text-sm opacity-60">No {game.toUpperCase()} equipment cosmetics added.</div>}
    <div className="flex flex-col gap-3">
      {entries.map((entry, localIndex) => <EquipmentFileRow
        key={`${entry.file.name}:${entry.file.lastModified}:${entry.globalIndex}`}
        file={entry.file}
        globalIndex={entry.globalIndex}
        localIndex={localIndex}
        localCount={entries.length}
        game={game}
        info={entry.info}
        onRemove={(globalIndex) => setFiles(files.filter((_, index) => index !== globalIndex))}
        onMove={move}
        onReplace={replace}
      />)}
    </div>
  </section>;
}

export function CosmeticsEditor() {
  const settings = useStore(state => state.settings);
  const options: { name: string, value: string }[] = Object.entries(COLORS).map(([key, x]) => ({ name: x.name, value: key }));
  options.push({ name: "Random", value: "random" });
  const equipmentKeys = new Set(['equipment', 'equipmentOot', 'equipmentMm']);
  const nonFiles = COSMETICS.filter(c => {
    const cond = (c as any).cond;
    return !equipmentKeys.has(c.key) && c.type !== 'file' && (!cond || cond(settings));
  });

  const files = COSMETICS.filter(c => {
    const cond = (c as any).cond;
    return !equipmentKeys.has(c.key) && c.type === 'file' && (!cond || cond(settings));
  });

  const games = (settings as any).games;
  const showOotEquipment = games !== 'mm';
  const showMmEquipment = games !== 'oot';

  return <main className="p-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {nonFiles.map(c => <Cosmetic key={c.key} cosmetic={c.key} />)}
    </div>
    <div className="flex gap-16 mt-16 justify-center">
      {files.map(c => <Cosmetic key={c.key} cosmetic={c.key} />)}
    </div>
    {(showOotEquipment || showMmEquipment) && <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-16">
      {showOotEquipment && <EquipmentFilesField game="oot" cosmeticKey="equipmentOot" label="Ocarina of Time Equipment" />}
      {showMmEquipment && <EquipmentFilesField game="mm" cosmeticKey="equipmentMm" label="Majora's Mask Equipment" />}
    </div>}
  </main>;
}

