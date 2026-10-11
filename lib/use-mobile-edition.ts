"use client";

import { useEffect, useState } from "react";

// Narrow windows use the phone layout; short touch screens stay in it when rotated.
const phoneQuery = "(max-width: 767px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023px)";

export function useMobileEdition() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(phoneQuery);
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile;
}
