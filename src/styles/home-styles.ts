import { baseStyles } from './home/base-styles';
import { setupStyles } from './home/setup-styles';
import { journeyStyles } from './home/journey-styles';
import { collectionStyles } from './home/collection-styles';
import { legacyStyles } from './home/legacy-styles';
import { ticketRecapStyles } from './home/ticket-recap-styles';
import { ticketInfoOverrides } from './home/ticket-info-overrides';
import { printerOverrides } from './home/printer-overrides';
import { recapOverrides } from './home/recap-overrides';

export const styles = {
  ...baseStyles,
  ...setupStyles,
  ...journeyStyles,
  ...collectionStyles,
  ...legacyStyles,
  ...ticketRecapStyles,
  ...ticketInfoOverrides,
  ...printerOverrides,
  ...recapOverrides,
};
