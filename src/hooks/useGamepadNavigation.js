import { useEffect, useRef, useState, useCallback } from "react";

const TABS = ["explore", "wishlist", "downloads", "library", "profile"];

export function useGamepadNavigation({ activeTab, setActiveTab, setToast }) {
  const [isConnected, setIsConnected] = useState(false);
  const [gamepadName, setGamepadName] = useState("");
  const [isUsingGamepad, setIsUsingGamepad] = useState(false);

  const lastMoveTimeRef = useRef(0);
  const lastButtonStatesRef = useRef({});
  const rafIdRef = useRef(null);

  // Helper: Find all visible focusable elements
  const getFocusableElements = useCallback(() => {
    return Array.from(
      document.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      ),
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        el.offsetParent !== null &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        el.getBoundingClientRect().width > 0 &&
        el.getBoundingClientRect().height > 0
      );
    });
  }, []);

  // Directional spatial navigation
  const navigateDirection = useCallback(
    (direction) => {
      const elements = getFocusableElements();
      if (elements.length === 0) return;

      const current = document.activeElement;
      if (!current || !elements.includes(current)) {
        elements[0].focus();
        elements[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      const curRect = current.getBoundingClientRect();
      const curCenterX = curRect.left + curRect.width / 2;
      const curCenterY = curRect.top + curRect.height / 2;

      let bestElement = null;
      let minDistance = Infinity;

      for (const el of elements) {
        if (el === current) continue;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = centerX - curCenterX;
        const dy = centerY - curCenterY;

        let isCandidate = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        switch (direction) {
          case "up":
            if (dy < -8) {
              isCandidate = true;
              primaryDist = Math.abs(dy);
              secondaryDist = Math.abs(dx);
            }
            break;
          case "down":
            if (dy > 8) {
              isCandidate = true;
              primaryDist = Math.abs(dy);
              secondaryDist = Math.abs(dx);
            }
            break;
          case "left":
            if (dx < -8) {
              isCandidate = true;
              primaryDist = Math.abs(dx);
              secondaryDist = Math.abs(dy);
            }
            break;
          case "right":
            if (dx > 8) {
              isCandidate = true;
              primaryDist = Math.abs(dx);
              secondaryDist = Math.abs(dy);
            }
            break;
        }

        if (isCandidate) {
          // Weight distance so candidates aligned on the axis are preferred
          const distance = primaryDist + secondaryDist * 2.2;
          if (distance < minDistance) {
            minDistance = distance;
            bestElement = el;
          }
        }
      }

      if (bestElement) {
        bestElement.focus();
        bestElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },
    [getFocusableElements],
  );

  // Switch tabs with Bumpers (LB/RB)
  const switchTab = useCallback(
    (direction) => {
      const currentIndex = TABS.indexOf(activeTab);
      if (currentIndex === -1) return;

      let nextIndex =
        direction === "next" ? currentIndex + 1 : currentIndex - 1;
      if (nextIndex >= TABS.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = TABS.length - 1;

      setActiveTab(TABS[nextIndex]);
    },
    [activeTab, setActiveTab],
  );

  // Main polling loop
  useEffect(() => {
    const handleGamepadConnected = (e) => {
      setIsConnected(true);
      setIsUsingGamepad(true);
      const name = e.gamepad.id || "Gamepad";
      setGamepadName(name);
      if (setToast) setToast(`🎮 Controller Connected: ${name.split("(")[0]}`);
    };

    const handleGamepadDisconnected = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const hasAny = Array.from(gamepads).some((g) => g && g.connected);
      if (!hasAny) {
        setIsConnected(false);
        setIsUsingGamepad(false);
        setGamepadName("");
        if (setToast) setToast("Controller Disconnected");
      }
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = Array.from(gamepads).find((g) => g && g.connected);

      if (gp) {
        if (!isConnected) {
          setIsConnected(true);
          setGamepadName(gp.id || "Gamepad");
        }

        const now = Date.now();
        const MOVE_DELAY = 180; // ms debounce between directional steps

        // 1. Directional Inputs (D-Pad + Left Stick)
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;

        const stickX = gp.axes[0] || 0;
        const stickY = gp.axes[1] || 0;
        const THRESHOLD = 0.45;

        if (now - lastMoveTimeRef.current > MOVE_DELAY) {
          if (dpadUp || stickY < -THRESHOLD) {
            setIsUsingGamepad(true);
            navigateDirection("up");
            lastMoveTimeRef.current = now;
          } else if (dpadDown || stickY > THRESHOLD) {
            setIsUsingGamepad(true);
            navigateDirection("down");
            lastMoveTimeRef.current = now;
          } else if (dpadLeft || stickX < -THRESHOLD) {
            setIsUsingGamepad(true);
            navigateDirection("left");
            lastMoveTimeRef.current = now;
          } else if (dpadRight || stickX > THRESHOLD) {
            setIsUsingGamepad(true);
            navigateDirection("right");
            lastMoveTimeRef.current = now;
          }
        }

        // 2. Buttons Edge-Trigger Check
        const isButtonPressed = (btnIdx) => {
          const btn = gp.buttons[btnIdx];
          const pressed = typeof btn === "object" ? btn.pressed : btn > 0.5;
          const wasPressed = !!lastButtonStatesRef.current[btnIdx];
          lastButtonStatesRef.current[btnIdx] = pressed;
          return pressed && !wasPressed; // True only on button down edge
        };

        // Button 0 (A / Cross): Click / Select
        if (isButtonPressed(0)) {
          setIsUsingGamepad(true);
          const current = document.activeElement;
          if (current && typeof current.click === "function") {
            current.click();
          }
        }

        // Button 1 (B / Circle): Back / Escape / Close Modal
        if (isButtonPressed(1)) {
          setIsUsingGamepad(true);
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        }

        // Button 3 (Y / Triangle): Focus Search Bar
        if (isButtonPressed(3)) {
          setIsUsingGamepad(true);
          const searchInput = document.querySelector('input[type="text"]');
          if (searchInput) {
            searchInput.focus();
          }
        }

        // Button 4 (LB / L1): Previous Tab
        if (isButtonPressed(4)) {
          setIsUsingGamepad(true);
          switchTab("prev");
        }

        // Button 5 (RB / R1): Next Tab
        if (isButtonPressed(5)) {
          setIsUsingGamepad(true);
          switchTab("next");
        }
      }

      rafIdRef.current = requestAnimationFrame(pollGamepad);
    };

    rafIdRef.current = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isConnected, navigateDirection, switchTab, setToast]);

  return {
    isConnected,
    gamepadName,
    isUsingGamepad,
  };
}
