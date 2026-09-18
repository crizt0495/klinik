"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

export function ForceChangePasswordGate({ mustChangePassword }: { mustChangePassword: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (mustChangePassword && pathname !== "/profile") {
      router.replace("/profile?force=1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustChangePassword, pathname]);

  return null;
}