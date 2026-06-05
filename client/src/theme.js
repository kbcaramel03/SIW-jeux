import { createTheme } from '@mui/material/styles';

// Thème MUI « girly mais sobre » : rose poudré + mauve, arrondi, doux.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#cf7b97', dark: '#b9667f', contrastText: '#ffffff' },
    secondary: { main: '#9a83b4', dark: '#84709e', contrastText: '#ffffff' },
    error: { main: '#cf7a86' },
    success: { main: '#7ba98f' },
    background: { default: '#f7f1f5', paper: '#ffffff' },
    text: { primary: '#463c52', secondary: '#8d8499' },
    divider: '#efe7ee',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "'Quicksand', 'Segoe UI', sans-serif",
    fontWeightMedium: 600,
    h1: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    h2: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    h3: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    h4: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    h5: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    h6: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600 },
    button: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, padding: '8px 18px' },
        sizeSmall: { padding: '5px 12px' },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 18 },
        elevation1: { boxShadow: '0 10px 30px rgba(110, 80, 120, 0.12)' },
      },
    },
    MuiTextField: { defaultProps: { variant: 'outlined', fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, background: '#fff' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});

export default theme;
