import { baseStyles } from './home/base-styles';
import { setupStyles } from './home/setup-styles';
import { journeyStyles } from './home/journey-styles';
import { collectionStyles } from './home/collection-styles';
import { legacyStyles } from './home/legacy-styles';
import { ticketRecapStyles } from './home/ticket-recap-styles';

export const styles = {
  ...baseStyles,
  ...setupStyles,
  ...journeyStyles,
  ...collectionStyles,
  ...legacyStyles,
  ...ticketRecapStyles,
};
