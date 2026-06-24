import { useCallback, useMemo } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { MM_AGE_REQ_ITEMS } from '@ootmm/core';

import { Select, Button, Card } from './ui';
import { useStore } from '../store';

type AgeSide = 'child' | 'adult';
type AgeReqItem = typeof MM_AGE_REQ_ITEMS[number];

function itemSetting(item: AgeReqItem, side: AgeSide) {
    return side === 'child' ? item.childSetting : item.adultSetting;
}

function oppositeSetting(item: AgeReqItem, side: AgeSide) {
    return side === 'child' ? item.adultSetting : item.childSetting;
}

export function MmAgeRequirements() {
    const settings = useStore(state => state.settings);
    const patchSettings = useStore(state => state.patchSettings);

    const childItems = useMemo(() => {
        return MM_AGE_REQ_ITEMS.filter(item => Boolean((settings as any)[item.childSetting]));
    }, [settings]);

    const adultItems = useMemo(() => {
        return MM_AGE_REQ_ITEMS.filter(item => Boolean((settings as any)[item.adultSetting]));
    }, [settings]);

    const usedItems = useMemo(() => {
        return new Set([...childItems, ...adultItems].map(item => item.id));
    }, [childItems, adultItems]);

    const itemOptions = useMemo(() => {
        return MM_AGE_REQ_ITEMS
            .filter(item => !usedItems.has(item.id))
            .slice()
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(item => ({
                value: item.id,
                label: item.label,
            }));
    }, [usedItems]);

    const addItem = useCallback((side: AgeSide, itemId: string | null) => {
        if (!itemId) {
            return;
        }

        const item = MM_AGE_REQ_ITEMS.find(x => x.id === itemId);
        if (!item) {
            return;
        }

        patchSettings({
            [itemSetting(item, side)]: true,
            [oppositeSetting(item, side)]: false,
        } as any);
    }, [patchSettings]);

    const removeItem = useCallback((side: AgeSide, item: AgeReqItem) => {
        patchSettings({
            [itemSetting(item, side)]: false,
        } as any);
    }, [patchSettings]);

    const removeAll = useCallback(() => {
        const patch: Record<string, boolean> = {};

        for (const item of MM_AGE_REQ_ITEMS) {
            patch[item.childSetting] = false;
            patch[item.adultSetting] = false;
        }

        patchSettings(patch as any);
    }, [patchSettings]);

    return (
        <main className="h-full flex flex-col">
            <nav className="flex justify-end gap-2">
                <Button variant="danger" onClick={removeAll}>Remove All</Button>
            </nav>

            <div className="grid grid-cols-2 gap-4 min-h-0 flex-1 mt-4">
                <AgeRequirementTable
                    title="Child"
                    items={childItems}
                    options={itemOptions}
                    onSelect={item => addItem('child', item)}
                    onRemove={item => removeItem('child', item)}
                />

                <AgeRequirementTable
                    title="Adult"
                    items={adultItems}
                    options={itemOptions}
                    onSelect={item => addItem('adult', item)}
                    onRemove={item => removeItem('adult', item)}
                />
            </div>
        </main>
    );
}

type AgeRequirementTableProps = {
    title: string;
    items: readonly AgeReqItem[];
    options: Array<{ value: string; label: string }>;
    onSelect: (item: string | null) => void;
    onRemove: (item: AgeReqItem) => void;
};

function AgeRequirementTable({
                                 title,
                                 items,
                                 options,
                                 onSelect,
                                 onRemove,
                             }: AgeRequirementTableProps) {
    return (
        <Card className="min-h-0 flex flex-col gap-3">
            <h2 className="text-xl font-semibold">{title}</h2>

            <Select
                searcheable
                placeholder="Add item"
                options={options}
                value={null}
                onSelect={onSelect}
            />

            <div className="min-h-0 overflow-y-auto flex flex-col gap-1">
                {items.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                        <span className="text-gray-500 text-2xl">No Age Requirements</span>
                    </div>
                )}

                {items
                    .slice()
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map(item => (
                        <div key={item.id} className="flex items-center gap-1">
              <span
                  className="hover:text-gray-500 cursor-pointer"
                  onClick={() => onRemove(item)}
              >
                <FaXmark />
              </span>

                            <span>{item.label}</span>
                        </div>
                    ))}
            </div>
        </Card>
    );
}