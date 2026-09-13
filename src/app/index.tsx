import { DetourHomeView } from '../components/detour-home-view';
import { useDetourHomeController } from '../hooks/use-detour-home-controller';

export default function HomeScreen() {
  const controller = useDetourHomeController();
  return <DetourHomeView controller={controller} />;
}
