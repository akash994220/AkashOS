import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { fetchExchangeRates, formatBDT, formatMultiCurrency } from '../../lib/currency';

interface CurrencyDisplayProps {
  amountBdt: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isNegative?: boolean;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amountBdt,
  size = 'md',
  className = '',
  isNegative = false,
}) => {
  const { userSettings } = useAuth();
  const { theme } = useTheme();
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchExchangeRates()
      .then((data) => {
        if (data?.rates) setRates(data.rates);
      })
      .catch(() => {});
  }, []);

  const selectedCurrencies = userSettings?.display_currencies || ['USD', 'EUR'];
  const formattedBDT = formatBDT(amountBdt);
  const convertedStr = formatMultiCurrency(amountBdt, selectedCurrencies, rates);

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 'text-xs';
      case 'md':
        return 'text-sm font-semibold';
      case 'lg':
        return 'text-base sm:text-lg font-bold';
      case 'xl':
        return 'text-xl sm:text-2xl font-bold';
    }
  };

  return (
    <span className={`inline-flex items-baseline gap-1.5 flex-wrap ${className}`}>
      <span className={`${getFontSize()} tracking-tight font-sans`}>
        {isNegative && '-'}
        {formattedBDT}
      </span>
      {convertedStr && (
        <span className="text-[11px] text-zinc-500 font-normal tracking-normal select-none">
          {convertedStr}
        </span>
      )}
    </span>
  );
};
