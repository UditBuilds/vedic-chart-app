'use client';

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  vx: number;
  vy: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
}

export function CosmicStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Star Palette: Platinum, Ice Blue, Solar Gold, Pale Violet
    const STAR_COLORS = ['#ffffff', '#f8fafc', '#e0f2fe', '#fef3c7', '#ede9fe'];

    // Generate ~120 multi-depth stars
    const starCount = Math.min(Math.floor((width * height) / 9000), 160);
    const stars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      const radius = Math.random() * 1.2 + 0.3;
      const baseAlpha = Math.random() * 0.7 + 0.2;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        baseAlpha,
        alpha: baseAlpha,
        twinkleSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }

    // Occasional shooting star
    const shootingStar: ShootingStar = {
      x: 0,
      y: 0,
      length: 80,
      speed: 12,
      angle: Math.PI / 4,
      alpha: 0,
      active: false,
    };

    const triggerShootingStar = () => {
      if (!shootingStar.active && Math.random() < 0.3) {
        shootingStar.x = Math.random() * width * 0.8;
        shootingStar.y = Math.random() * (height * 0.4);
        shootingStar.length = Math.random() * 60 + 60;
        shootingStar.speed = Math.random() * 6 + 10;
        shootingStar.alpha = 1;
        shootingStar.active = true;
      }
    };

    const interval = setInterval(triggerShootingStar, 4000);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        star.alpha += star.twinkleSpeed;
        if (star.alpha > 0.95 || star.alpha < 0.15) {
          star.twinkleSpeed = -star.twinkleSpeed;
        }

        star.x += star.vx;
        star.y += star.vy;

        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.alpha;
        ctx.shadowBlur = star.radius > 1 ? 4 : 0;
        ctx.shadowColor = star.color;
        ctx.fill();
      }

      // Draw Shooting Star if active
      if (shootingStar.active) {
        ctx.save();
        ctx.beginPath();
        const endX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.length;
        const endY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.length;

        const gradient = ctx.createLinearGradient(
          shootingStar.x,
          shootingStar.y,
          endX,
          endY
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, ${shootingStar.alpha})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.restore();

        shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
        shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
        shootingStar.alpha -= 0.02;

        if (shootingStar.alpha <= 0 || shootingStar.x > width || shootingStar.y > height) {
          shootingStar.active = false;
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
    />
  );
}
