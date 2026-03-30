"""Dependency Injection container.

Provides centralized service registration and resolution.
"""

import logging
from typing import Any, Callable, Optional, Type, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar('T')


class Container:
    """Simple dependency injection container.
    
    Features:
    - Singleton service registration
    - Factory-based resolution
    - Type-safe retrieval
    """
    
    def __init__(self):
        """Initialize container."""
        self._services: dict[str, Any] = {}
        self._factories: dict[str, Callable[[], Any]] = {}
    
    def register_singleton(self, name: str, instance: Any) -> None:
        """Register a singleton instance.
        
        Args:
            name: Service name/key
            instance: Instance to register
        """
        self._services[name] = instance
        logger.debug(f"Registered singleton: {name}")
    
    def register_factory(self, name: str, factory: Callable[[], Any]) -> None:
        """Register a factory function.
        
        Args:
            name: Service name/key
            factory: Function that creates instances
        """
        self._factories[name] = factory
        logger.debug(f"Registered factory: {name}")
    
    def get(self, name: str) -> Any:
        """Get a service by name.
        
        Args:
            name: Service name
            
        Returns:
            Service instance
            
        Raises:
            KeyError: If service not found
        """
        # Check singletons first
        if name in self._services:
            return self._services[name]
        
        # Check factories
        if name in self._factories:
            instance = self._factories[name]()
            self._services[name] = instance  # Cache as singleton
            return instance
        
        raise KeyError(f"Service not found: {name}")
    
    def get_optional(self, name: str) -> Optional[Any]:
        """Get a service by name, returning None if not found.
        
        Args:
            name: Service name
            
        Returns:
            Service instance or None
        """
        try:
            return self.get(name)
        except KeyError:
            return None
    
    def has(self, name: str) -> bool:
        """Check if a service is registered.
        
        Args:
            name: Service name
            
        Returns:
            True if registered
        """
        return name in self._services or name in self._factories
    
    def clear(self) -> None:
        """Clear all registered services."""
        self._services.clear()
        self._factories.clear()


# Global container instance
_container: Optional[Container] = None


def get_container() -> Container:
    """Get the global container instance.
    
    Returns:
        Container instance
    """
    global _container
    if _container is None:
        _container = Container()
    return _container


def reset_container() -> None:
    """Reset the global container (for testing)."""
    global _container
    if _container:
        _container.clear()
    _container = Container()


def register_services(
    telegram_service: Any,
    price_service: Any,
    signal_parser: Any,
    trade_manager: Any,
    websocket_broadcaster: Any,
    bot_state_manager: Any,
) -> None:
    """Register all core services in the container.
    
    Args:
        telegram_service: Telegram service instance
        price_service: Price service instance
        signal_parser: Signal parser instance
        trade_manager: Trade manager instance
        websocket_broadcaster: WebSocket broadcaster instance
        bot_state_manager: Bot state manager instance
    """
    container = get_container()
    
    container.register_singleton("telegram_service", telegram_service)
    container.register_singleton("price_service", price_service)
    container.register_singleton("signal_parser", signal_parser)
    container.register_singleton("trade_manager", trade_manager)
    container.register_singleton("websocket_broadcaster", websocket_broadcaster)
    container.register_singleton("bot_state_manager", bot_state_manager)
    
    logger.info("All services registered in container")


def get_telegram_service() -> Any:
    """Get Telegram service."""
    return get_container().get("telegram_service")


def get_price_service() -> Any:
    """Get price service."""
    return get_container().get("price_service")


def get_signal_parser() -> Any:
    """Get signal parser."""
    return get_container().get("signal_parser")


def get_trade_manager() -> Any:
    """Get trade manager."""
    return get_container().get("trade_manager")


def get_websocket_broadcaster() -> Any:
    """Get WebSocket broadcaster."""
    return get_container().get("websocket_broadcaster")


def get_bot_state_manager() -> Any:
    """Get bot state manager."""
    return get_container().get("bot_state_manager")
