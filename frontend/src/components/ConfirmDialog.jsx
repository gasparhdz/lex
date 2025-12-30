import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Button, Stack
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  description = "",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  confirmColor = "primary",   // "primary" | "error" | ...
  loading = false,
  onClose,
  onConfirm,
}) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-title"
    >
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <WarningAmberRoundedIcon color="warning" sx={{ mt: 0.2 }} />
          <DialogContentText sx={{ mt: 0.25 }}>
            {description}
          </DialogContentText>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading} variant="outlined">
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={confirmColor}
        >
          {loading ? "Eliminando..." : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
