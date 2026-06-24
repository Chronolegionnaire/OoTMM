import type { TabViewRoute } from '../nav';
import { LuPackage, LuUsers, LuPuzzle, LuClock, LuTrendingUp } from 'react-icons/lu';

import { useStore } from '@/app/store';
import { TabView } from '../nav';
import { StartingItems } from '../StartingItems';
import { SettingsEditor } from '../settings';
import {MmAgeRequirements} from "@/app/components/mmAgeRequirements.tsx";

const PageProgressive = () => <SettingsEditor category='items.progressive'/>;
const PageShared = () => <SettingsEditor category='items.shared'/>;
const PageExtensions = () => <SettingsEditor category='items.extensions'/>;
const PageAgeless = () => <SettingsEditor category='items.ageless'/>;
const PageMmAgeRequirements = () => <MmAgeRequirements />;

export function GeneratorItems() {
  const games = useStore(state => state.settings.games);

  const routes: TabViewRoute[] = [
    { name: 'Progressive', icon: LuTrendingUp, component: PageProgressive },
    { name: 'Shared', icon: LuUsers, component: PageShared, disabled: games !== 'ootmm' },
    { name: 'Extensions', icon: LuPuzzle, component: PageExtensions },
    { name: 'Ageless', icon: LuClock, component: PageAgeless, disabled: games === 'mm' },
    { name: 'MM Age Req.', icon: LuClock, component: PageMmAgeRequirements, disabled: games === 'oot' },
    { name: 'Starting Items', icon: LuPackage, component: StartingItems }
  ];

  return <TabView routes={routes}/>;
}
