"use client";
import { AuthGate } from './components/auth-gate';
import { ResourcesGestion } from './gestions/resources';

/** Thin app entry: auth gate + gestion workspace (Ressources owns the shell until other gestions grow). */
export default function Page() {
  return (
    <AuthGate>
      <ResourcesGestion />
    </AuthGate>
  );
}
