import { TearLab } from '../components/tear-lab';

// This branch is intentionally a tear-interaction lab.
// It no longer swaps the production ready screen out from under the user.
// Once the paper interaction is approved, it will be integrated back into
// the existing printer/ready screen without unmounting that scene.
export default function HomeScreen() {
  return <TearLab />;
}
