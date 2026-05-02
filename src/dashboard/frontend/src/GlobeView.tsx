import React, { useEffect, useRef } from "react";
import type { TelemetryPoint } from "./api";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

interface GlobeViewProps {
  telemetry: TelemetryPoint[];
}

export const GlobeView: React.FC<GlobeViewProps> = ({ telemetry }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const sampledPositions = useRef<Map<string, Cesium.SampledPositionProperty>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    (window as any).CESIUM_BASE_URL = "/static/cesium/";

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      shouldAnimate: false,
    });

    viewer.scene.skyBox.show = false;
    viewer.scene.skyAtmosphere.show = false;
    viewer.clock.shouldAnimate = false;
    viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        credit: "© Esri",
        maximumLevel: 19,
      })
    );

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 15000000),
    });

    viewerRef.current = viewer;

    return () => {
      sampledPositions.current.clear();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !telemetry.length) return;

    telemetry.forEach((point) => {
      if (!point.timestamp) return;

      const julianTime = Cesium.JulianDate.fromIso8601(point.timestamp);
      const cartesian = Cesium.Cartesian3.fromDegrees(
        point.longitude,
        point.latitude,
        (point.altitude ?? 0) * 1000
      );

      // Advance the viewer clock to match simulation time
      viewer.clock.currentTime = julianTime;

      let sampledPos = sampledPositions.current.get(point.satellite);

      if (!sampledPos) {
        sampledPos = new Cesium.SampledPositionProperty();
        sampledPos.setInterpolationOptions({
          interpolationDegree: 5,
          interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
        });
        sampledPositions.current.set(point.satellite, sampledPos);

        viewer.entities.add({
          id: point.satellite,
          position: sampledPos,
          point: {
            pixelSize: 14,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.6),
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.5, 4.5e7, 0.5),
          },
          path: {
            resolution: 1,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: Cesium.Color.CYAN.withAlpha(0.6),
            }),
            width: 2,
            leadTime: 0,
            trailTime: 5400, // 90-minute orbital trail
          },
        });
      }

      sampledPos.addSample(julianTime, cartesian);
    });
  }, [telemetry]);

  return <div ref={containerRef} className="globe-view" />;
};
