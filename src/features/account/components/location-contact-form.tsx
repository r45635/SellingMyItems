"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COUNTRY_PHONE_PREFIXES } from "@/lib/phone";
import {
  updateLocationContactAction,
  retryGeocodeLocationAction,
} from "../actions";

interface LocationContactFormProps {
  defaultCountry: string | null;
  defaultPostalCode: string | null;
  defaultPhone: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function LocationContactForm({
  defaultCountry,
  defaultPostalCode,
  defaultPhone,
  latitude,
  longitude,
}: LocationContactFormProps) {
  const t = useTranslations("account");
  const [country, setCountry] = useState<string>(defaultCountry ?? "");

  const phonePrefix =
    country && country in COUNTRY_PHONE_PREFIXES
      ? COUNTRY_PHONE_PREFIXES[country as keyof typeof COUNTRY_PHONE_PREFIXES][0]
      : null;

  const isResolved = latitude != null && longitude != null;
  const hasLocation = !!defaultCountry && !!defaultPostalCode;
  const needsRetry = hasLocation && !isResolved;

  return (
    <>
      <form action={updateLocationContactAction} className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-orange-500" />
          <p className="text-sm font-semibold">{t("locationContactTitle")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("locationContactDesc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="countryCode" className="block text-sm font-medium mb-1">
              {t("country")}
            </label>
            <select
              id="countryCode"
              name="countryCode"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">—</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="FR">France</option>
            </select>
          </div>

          <div>
            <label htmlFor="postalCode" className="block text-sm font-medium mb-1">
              {t("postalCode")}
            </label>
            <Input
              id="postalCode"
              name="postalCode"
              type="text"
              defaultValue={defaultPostalCode ?? ""}
              placeholder="75001"
              autoComplete="postal-code"
            />
          </div>
        </div>

        {/* Geocode status badge */}
        {isResolved ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            ✓ {t("locationResolved")}
          </p>
        ) : hasLocation ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            ⚠ {t("locationUnresolved")}
          </p>
        ) : null}

        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-1">
            {t("phone")}
          </label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultPhone ?? ""}
            placeholder={phonePrefix ? `${phonePrefix} 6 12 34 56 78` : "+X XXX XXX XXXX"}
            autoComplete="tel"
          />
          {phonePrefix ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("phoneCountryHint", { prefix: phonePrefix })}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("phoneNoCountry")}
            </p>
          )}
        </div>

        <Button type="submit" size="sm">
          {t("save")}
        </Button>
      </form>

      {/* Retry geocode — separate form so it doesn't carry the input fields */}
      {needsRetry && (
        <form action={retryGeocodeLocationAction} className="mt-3 flex justify-end">
          <Button type="submit" size="sm" variant="outline">
            {t("retryGeocode")}
          </Button>
        </form>
      )}
    </>
  );
}
