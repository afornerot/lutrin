import os

COLOR_RESET = "\033[0m"
COLOR_RED = "\033[91m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_BLUE = "\033[94m"
COLOR_CYAN = "\033[96m"

def _get_terminal_width(default=150):
    """
    Gets terminal width, with a fallback.
    """
    
    try:
        return os.get_terminal_size().columns
    except OSError:
        return default

def _print_colored(message, color, prefix=""):
    """Helper function to print a colored message."""
    print(f"{color}{prefix}{message}{COLOR_RESET}")

def BigTitle(message):
    """Prints a large, formatted title that adapts to terminal width (in green)."""
    width = _get_terminal_width()
    line = "=" * width
    
    # Prépare le message et calcule le remplissage
    title_text = f"== {message.upper()} "
    padding = "=" * (width - len(title_text))
    
    _print_colored(f"\n\n{line}\n{title_text}{padding}\n{line}", COLOR_GREEN)

def Title(message):
    """Prints a regular, formatted title that adapts to terminal width (in cyan)."""
    width = _get_terminal_width()
    title_text = f"== {message.upper()} "
    padding = "=" * (width - len(title_text))
    _print_colored(f"\n{title_text}{padding}\n", COLOR_CYAN)

def Line(character='-', length=70):
    """Prints a separator line."""
    print(character * length)

def Error(message):
    """Prints an error message in red."""
    _print_colored(f"ERREUR = {message}", COLOR_RED)

def Warning(message):
    """Prints a warning message in yellow."""
    _print_colored(f"AVERTISSEMENT = {message}", COLOR_YELLOW)

def Success(message):
    """Prints a success message in green."""
    _print_colored(f"SUCCÈS = {message}", COLOR_GREEN)

def Info(message):
    """Prints an informational message in blue."""
    _print_colored(f"INFO = {message}", COLOR_BLUE)

def Log(message):
    """Prints a standard log message without special formatting."""
    print(message)