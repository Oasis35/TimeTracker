import { MatSnackBar } from '@angular/material/snack-bar';

const SNACK_CONFIG = {
  duration: 2400,
  horizontalPosition: 'right' as const,
  verticalPosition: 'top' as const,
};

export function showSnack(snackBar: MatSnackBar, message: string): void {
  snackBar.open(message, undefined, SNACK_CONFIG);
}
