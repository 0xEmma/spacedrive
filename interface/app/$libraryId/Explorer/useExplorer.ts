import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { proxy, snapshot, subscribe, useSnapshot } from 'valtio';
import { z } from 'zod';
import { ExplorerItem, ExplorerSettings, FilePath, Location, NodeState, Tag } from '@sd/client';
import { Ordering, OrderingKeys, createDefaultExplorerSettings } from './store';
import { explorerItemHash } from './util';

export type ExplorerParent =
	| {
			type: 'Location';
			location: Location;
			subPath?: FilePath;
	  }
	| {
			type: 'Tag';
			tag: Tag;
	  }
	| {
			type: 'Node';
			node: NodeState;
	  };

export interface UseExplorerProps<TOrder extends Ordering> {
	items: ExplorerItem[] | null;
	parent?: ExplorerParent;
	loadMore?: () => void;
	scrollRef?: RefObject<HTMLDivElement>;
	/**
	 * @defaultValue `true`
	 */
	allowMultiSelect?: boolean;
	/**
	 * @defaultValue `5`
	 */
	rowsBeforeLoadMore?: number;
	overscan?: number;
	/**
	 * @defaultValue `true`
	 */
	selectable?: boolean;
	settings: ReturnType<typeof useExplorerSettings<TOrder>>;
}

export type ExplorerItemMeta = {
	type: 'Location' | 'Path' | 'Object';
	id: number;
};

export type ExplorerItemHash = `${ExplorerItemMeta['type']}:${ExplorerItemMeta['id']}`;

/**
 * Controls top-level config and state for the explorer.
 * View- and inspector-specific state is not handled here.
 */
export function useExplorer<TOrder extends Ordering>({
	settings,
	...props
}: UseExplorerProps<TOrder>) {
	const scrollRef = useRef<HTMLDivElement>(null);

	return {
		// Default values
		allowMultiSelect: true,
		rowsBeforeLoadMore: 5,
		selectable: true,
		scrollRef,
		...settings,
		// Provided values
		...props,
		// Selected items
		...useSelectedItems(props.items)
	};
}

export type UseExplorer<TOrder extends Ordering> = ReturnType<typeof useExplorer<TOrder>>;

export function useExplorerSettings<TOrder extends Ordering>({
	settings,
	onSettingsChanged,
	orderingKeys
}: {
	settings: ReturnType<typeof createDefaultExplorerSettings<TOrder>>;
	onSettingsChanged: (settings: ExplorerSettings<TOrder>) => any;
	orderingKeys?: z.ZodUnion<
		[z.ZodLiteral<OrderingKeys<TOrder>>, ...z.ZodLiteral<OrderingKeys<TOrder>>[]]
	>;
}) {
	const [store] = useState(() => proxy(settings));

	useEffect(() => {
		Object.assign(store, settings);
	}, [store, settings]);

	useEffect(
		() =>
			subscribe(store, () => {
				onSettingsChanged(snapshot(store) as ExplorerSettings<TOrder>);
			}),
		[onSettingsChanged, store]
	);

	return {
		useSettingsSnapshot: () => useSnapshot(store),
		settingsStore: store,
		orderingKeys
	};
}

export type UseExplorerSettings<TOrder extends Ordering> = ReturnType<
	typeof useExplorerSettings<TOrder>
>;

function useSelectedItems(items: ExplorerItem[] | null) {
	// Doing pointer lookups for hashes is a bit faster than assembling a bunch of strings
	// WeakMap ensures that ExplorerItems aren't held onto after they're evicted from cache
	const itemHashesWeakMap = useRef(new WeakMap<ExplorerItem, ExplorerItemHash>());

	// Store hashes of items instead as objects are unique by reference but we
	// still need to differentate between item variants
	const [selectedItemHashes, setSelectedItemHashes] = useState(() => ({
		value: new Set<ExplorerItemHash>()
	}));

	const updateHashes = useCallback(
		() => setSelectedItemHashes((h) => ({ ...h })),
		[setSelectedItemHashes]
	);

	const itemsMap = useMemo(
		() =>
			(items ?? []).reduce((items, item) => {
				const hash = itemHashesWeakMap.current.get(item) ?? explorerItemHash(item);
				itemHashesWeakMap.current.set(item, hash);
				items.set(hash, item);
				return items;
			}, new Map<ExplorerItemHash, ExplorerItem>()),
		[items]
	);

	const selectedItems = useMemo(
		() =>
			[...selectedItemHashes.value].reduce((items, hash) => {
				const item = itemsMap.get(hash);
				if (item) items.add(item);
				return items;
			}, new Set<ExplorerItem>()),
		[itemsMap, selectedItemHashes]
	);

	return {
		selectedItems,
		selectedItemHashes,
		addSelectedItem: useCallback(
			(item: ExplorerItem) => {
				selectedItemHashes.value.add(explorerItemHash(item));
				updateHashes();
			},
			[selectedItemHashes.value, updateHashes]
		),
		removeSelectedItem: useCallback(
			(item: ExplorerItem) => {
				selectedItemHashes.value.delete(explorerItemHash(item));
				updateHashes();
			},
			[selectedItemHashes.value, updateHashes]
		),
		resetSelectedItems: useCallback(
			(items?: ExplorerItem[]) => {
				selectedItemHashes.value.clear();
				items?.forEach((item) => selectedItemHashes.value.add(explorerItemHash(item)));
				updateHashes();
			},
			[selectedItemHashes.value, updateHashes]
		)
	};
}