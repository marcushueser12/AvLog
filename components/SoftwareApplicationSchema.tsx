import { useEffect } from 'react';

const SoftwareApplicationSchema: React.FC = () => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "LogExtract",
      "applicationCategory": "AviationApplication",
      "operatingSystem": "Web",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "AI-powered logbook digitization tool for pilots. Convert paper logbooks to digital format using advanced AI technology.",
      "featureList": [
        "AI-powered logbook scanning",
        "Handwriting recognition for messy logbook entries",
        "Automatic data extraction from paper logbooks",
        "ForeFlight-compatible CSV export",
        "Pair mode for two-page logbook spreads",
        "IFR cross-check validation",
        "Aircraft profile management",
        "Instrument approach procedure tracking"
      ],
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1"
      },
      "screenshot": "https://logextract.co/screenshot.png",
      "softwareVersion": "1.0",
      "releaseNotes": "Initial release with advanced AI integration",
      "author": {
        "@type": "Person",
        "name": "LogExtract Team",
        "jobTitle": "Instrument Rated Pilot"
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    script.id = 'software-application-schema';
    
    // Remove existing schema if present
    const existing = document.getElementById('software-application-schema');
    if (existing) {
      existing.remove();
    }
    
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById('software-application-schema');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, []);

  return null;
};

export default SoftwareApplicationSchema;
