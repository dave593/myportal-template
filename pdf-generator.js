// pdf-generator.js
// Professional PDF Generation System for Fire Escape Reports

class PDFGenerator {
    constructor() {
        this.jsPDF = null;
        this.html2canvas = null;
        // Don't auto-initialize - wait for explicit call
    }

    async initializeLibraries() {
        try {
            // Load jsPDF dynamically - browser only
            if (typeof window !== 'undefined' && window.jspdf) {
                this.jsPDF = window.jspdf;
                console.log('✅ jsPDF loaded from window.jspdf');
            } else {
                console.error('❌ jsPDF not found in window.jspdf');
                throw new Error('jsPDF library not available');
            }

            // Load html2canvas dynamically - browser only
            if (typeof window !== 'undefined' && window.html2canvas) {
                this.html2canvas = window.html2canvas;
                console.log('✅ html2canvas loaded from window object');
            } else {
                console.error('❌ html2canvas not found in window object');
                throw new Error('html2canvas library not available');
            }
        } catch (error) {
            console.error('Error initializing PDF libraries:', error);
            throw error;
        }
    }

    async generateFireEscapeReport(reportData, options = {}) {
        try {
            // Validate input data
            if (!reportData || !reportData.clientName) {
                throw new Error('Invalid report data: clientName is required');
            }

            await this.initializeLibraries();

            const {
                company = 'Boston Fire Escape Services',
                includePhotos = true,
                pageBreak = true,
                quality = 0.95
            } = options;

            // Create PDF document
            const { jsPDF } = this.jsPDF;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Set document properties
            pdf.setProperties({
                title: `Fire Escape Inspection Report - ${reportData.clientName}`,
                subject: 'Fire Escape Inspection',
                author: company,
                creator: 'Fire Escape Portal System',
                creationDate: new Date()
            });

            // Add company header
            await this.addCompanyHeader(pdf, company);

            // Add report title
            this.addReportTitle(pdf, reportData);

            // Add client information
            this.addClientInformation(pdf, reportData);

            // Add inspection details
            this.addInspectionDetails(pdf, reportData);

            // Add findings and recommendations
            if (reportData.findings || reportData.recommendations) {
                if (pageBreak) pdf.addPage();
                this.addFindingsAndRecommendations(pdf, reportData);
            }

            // Add photos if available
            if (includePhotos && reportData.photos && reportData.photos.length > 0) {
                if (pageBreak) pdf.addPage();
                await this.addPhotos(pdf, reportData.photos);
            }

            // Add footer
            this.addFooter(pdf, company);

            return pdf;
        } catch (error) {
            console.error('Error generating PDF:', error);
            throw error;
        }
    }

    async addCompanyHeader(pdf, company) {
        // Professional header with gradient effect
        pdf.setFillColor(220, 38, 38);
        pdf.rect(0, 0, 210, 40, 'F');
        
        // Add subtle pattern for professional look
        pdf.setFillColor(200, 30, 30);
        for (let i = 0; i < 210; i += 8) {
            pdf.rect(i, 0, 3, 40, 'F');
        }
        
        // Company name with professional styling
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(20);
        pdf.setFont(undefined, 'bold');
        pdf.text(company, 22, 25);

        // Company details
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.text('Professional Fire Escape Services', 22, 32);
        pdf.text('Licensed & Insured • Certified Inspectors', 22, 37);

        // Date and Report ID with professional styling
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Date: ${new Date().toLocaleDateString()}`, 150, 25);
        pdf.text(`Report ID: ${this.generateReportId()}`, 150, 30);

        // Professional border
        pdf.setDrawColor(180, 25, 25);
        pdf.setLineWidth(0.8);
        pdf.line(0, 40, 210, 40);
    }

    addReportTitle(pdf, reportData) {
        // Professional title with background
        pdf.setFillColor(243, 244, 246);
        pdf.rect(15, 50, 180, 25, 'F');
        
        // Title with professional styling
        pdf.setFontSize(20);
        pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'bold');
        pdf.text('FIRE ESCAPE INSPECTION REPORT', 20, 65);

        // Subtitle
        pdf.setFontSize(12);
        pdf.setTextColor(107, 114, 128);
        pdf.setFont(undefined, 'normal');
        pdf.text('Professional Safety Assessment & Compliance Documentation', 20, 72);

        // Inspection type with professional styling
        pdf.setFontSize(11);
        pdf.setTextColor(55, 65, 81);
        pdf.text(`Inspection Type: ${reportData.inspectionType || 'General Inspection'}`, 20, 80);
    }

    addClientInformation(pdf, reportData) {
        // Section header with professional styling
        pdf.setFontSize(14);
        pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'bold');
        pdf.text('CLIENT & PROPERTY INFORMATION', 20, 105);

        // Professional background for client info - more compact
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, 110, 180, 35, 'F'); // Reducido de 45 a 35
        pdf.setDrawColor(220, 38, 38);
        pdf.setLineWidth(0.5);
        pdf.rect(15, 110, 180, 35); // Reducido de 45 a 35

        // Client details with better formatting
        pdf.setFontSize(10);
        pdf.setTextColor(55, 65, 81);
        pdf.setFont(undefined, 'normal');

        const clientInfo = [
            `Client Name: ${reportData.clientName || 'N/A'}`,
            `Email: ${reportData.email || 'N/A'}`,
            `Phone: ${reportData.phone || 'N/A'}`,
            `Property Type: ${reportData.propertyType || 'N/A'}`,
            `Property Address: ${reportData.address || 'N/A'}`,
            `Inspection Date: ${reportData.inspectionDate || new Date().toLocaleDateString()}`,
            `Inspector: ${reportData.inspector || 'Certified Inspector'}`,
            `Weather Conditions: ${reportData.weatherConditions || 'N/A'}`
        ];

        let yPosition = 120;
        clientInfo.forEach(info => {
            pdf.text(info, 20, yPosition);
            yPosition += 4; // Reducido de 5 a 4 para más compacto
        });
    }

    addInspectionDetails(pdf, reportData) {
        // Section header with professional styling
        pdf.setFontSize(14);
        pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'bold');
        pdf.text('FIRE ESCAPE SYSTEM DETAILS', 20, 170);

        // Professional background for system details - more compact
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, 175, 180, 25, 'F'); // Reducido de 35 a 25
        pdf.setDrawColor(220, 38, 38);
        pdf.setLineWidth(0.5);
        pdf.rect(15, 175, 180, 25); // Reducido de 35 a 25

        // System details with better formatting
        pdf.setFontSize(10);
        pdf.setTextColor(55, 65, 81);
        pdf.setFont(undefined, 'normal');

        const systemDetails = [
            `Number of Escapes: ${reportData.numberOfEscapes || 'N/A'}`,
            `Construction Material: ${reportData.constructionMaterial || 'N/A'}`,
            `Inspection Type: ${reportData.inspectionType || 'General Inspection'}`,
            `Escape Type: ${reportData.escapeType || 'N/A'}`,
            `System Age: ${reportData.systemAge || 'N/A'}`,
            `Access Method: ${reportData.accessMethod || 'N/A'}`
        ];

        let yPosition = 185;
        systemDetails.forEach(detail => {
            pdf.text(detail, 20, yPosition);
            yPosition += 4; // Reducido de 5 a 4 para más compacto
        });
    }

    addFindingsAndRecommendations(pdf, reportData) {
        // Findings
        if (reportData.findings) {
            pdf.setFontSize(12);
            pdf.setTextColor(17, 24, 39);
            pdf.text('FINDINGS', 20, 30);

            pdf.setFontSize(10);
            pdf.setTextColor(55, 65, 81);
            
            const findings = this.wrapText(reportData.findings, 160);
            let yPosition = 40;
            findings.forEach(line => {
                pdf.text(line, 20, yPosition);
                yPosition += 5;
            });
        }

        // Recommendations
        if (reportData.recommendations) {
            const findingsHeight = reportData.findings ? this.getTextHeight(reportData.findings, 160) : 0;
            const startY = 40 + findingsHeight + 20;

            pdf.setFontSize(12);
            pdf.setTextColor(17, 24, 39);
            pdf.text('RECOMMENDATIONS', 20, startY);

            pdf.setFontSize(10);
            pdf.setTextColor(55, 65, 81);
            
            const recommendations = this.wrapText(reportData.recommendations, 160);
            let yPosition = startY + 10;
            recommendations.forEach(line => {
                pdf.text(line, 20, yPosition);
                yPosition += 5;
            });
        }
    }

    async addPhotos(pdf, photos) {
        // Filter out inappropriate photos (ads, stock photos, etc.)
        const filteredPhotos = this.filterAppropriatePhotos(photos);
        
        if (filteredPhotos.length === 0) {
            pdf.setFontSize(12);
            pdf.setTextColor(107, 114, 128);
            pdf.text('No inspection photos available', 20, 30);
            return;
        }

        // Professional header
        pdf.setFontSize(14);
        pdf.setTextColor(17, 24, 39);
        pdf.setFont(undefined, 'bold');
        pdf.text('PHOTO DOCUMENTATION', 20, 30);
        
        // Subtitle
        pdf.setFontSize(10);
        pdf.setTextColor(107, 114, 128);
        pdf.setFont(undefined, 'normal');
        pdf.text('Professional Inspection Evidence', 20, 35);

        let currentY = 45;
        const maxWidth = 80; // Reducido de 170 a 80
        const maxHeight = 60; // Reducido de 100 a 60
        const margin = 10; // Reducido de 15 a 10
        const photosPerRow = 2;

        for (let i = 0; i < filteredPhotos.length; i++) {
            try {
                const photo = filteredPhotos[i];
                
                // Check if we need a new page - optimized for better page breaks
                if (currentY + maxHeight > 270) { // Aumentado de 250 a 270
                    pdf.addPage();
                    currentY = 20;
                    
                    // Add header to new page
                    pdf.setFontSize(14);
                    pdf.setTextColor(17, 24, 39);
                    pdf.setFont(undefined, 'bold');
                    pdf.text('PHOTO DOCUMENTATION (Continued)', 20, 30);
                    currentY = 35;
                }

                // Calculate position for grid layout - optimized for page width
                const row = Math.floor(i / photosPerRow);
                const col = i % photosPerRow;
                const x = 20 + (col * (maxWidth + margin));
                const y = currentY + (row * (maxHeight + 20)); // Reducido de 25 a 20

                // Add photo (if it's a base64 string or URL)
                if (photo.data || photo.url) {
                    try {
                        const imgData = photo.data || photo.url;
                        const img = new Image();
                        
                        await new Promise((resolve, reject) => {
                            img.onload = resolve;
                            img.onerror = reject;
                            img.src = imgData;
                        });

                        // Calculate dimensions to fit within maxWidth x maxHeight
                        const aspectRatio = img.width / img.height;
                        let width = maxWidth;
                        let height = width / aspectRatio;

                        if (height > maxHeight) {
                            height = maxHeight;
                            width = height * aspectRatio;
                        }

                        // Add photo with border
                        pdf.setDrawColor(220, 38, 38);
                        pdf.setLineWidth(0.5);
                        pdf.rect(x - 1, y - 1, width + 2, height + 2);
                        
                        pdf.addImage(imgData, 'JPEG', x, y, width, height);
                        
                        // Add photo caption
                        pdf.setFontSize(8);
                        pdf.setTextColor(55, 65, 81);
                        const caption = photo.caption || photo.name || `Inspection Photo ${i + 1}`;
                        const captionText = this.wrapText(caption, width);
                        pdf.text(captionText, x, y + height + 5);
                        
                    } catch (imgError) {
                        console.warn('Error adding photo:', imgError);
                        // Add placeholder for failed photo
                        pdf.setFillColor(243, 244, 246);
                        pdf.rect(x, y, maxWidth, maxHeight, 'F');
                        pdf.setTextColor(156, 163, 175);
                        pdf.text('Photo unavailable', x + maxWidth/2 - 15, y + maxHeight/2);
                    }
                }
                
                // Update currentY for next row - optimized spacing
                if (col === photosPerRow - 1 || i === filteredPhotos.length - 1) {
                    currentY = y + maxHeight + 15; // Reducido de 30 a 15
                }
                
            } catch (error) {
                console.warn('Error processing photo:', error);
            }
        }
    }

    filterAppropriatePhotos(photos) {
        return photos.filter(photo => {
            // Filter out photos that contain advertising text
            const photoName = (photo.name || '').toLowerCase();
            const photoCaption = (photo.caption || '').toLowerCase();
            
            // Keywords that indicate advertising or inappropriate content
            const adKeywords = [
                'free estimates', 'custom', 'railings', 'gates', 'advertisement',
                'ad', 'promo', 'promotion', 'sale', 'discount', 'offer',
                'call now', 'contact us', 'phone', 'tel:', 'www.',
                'stock photo', 'shutterstock', 'istock', 'getty'
            ];
            
            // Check if photo name or caption contains ad keywords
            const containsAdKeywords = adKeywords.some(keyword => 
                photoName.includes(keyword) || photoCaption.includes(keyword)
            );
            
            // Filter out photos with ad keywords
            if (containsAdKeywords) {
                console.log('Filtered out photo with ad content:', photoName);
                return false;
            }
            
            return true;
        });
    }

    addFooter(pdf, company) {
        const pageCount = pdf.internal.getNumberOfPages();
        
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            
            // Footer line
            pdf.setDrawColor(220, 38, 38);
            pdf.setLineWidth(0.5);
            pdf.line(20, 280, 190, 280);

            // Footer text
            pdf.setFontSize(8);
            pdf.setTextColor(107, 114, 128); // Light gray
            pdf.text(`${company} - Professional Fire Escape Services`, 20, 285);
            pdf.text(`Page ${i} of ${pageCount}`, 150, 285);
            pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, 290);
        }
    }

    // Utility methods
    generateReportId() {
        return `FE-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    }

    wrapText(text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const testWidth = this.getTextWidth(testLine);
            
            if (testWidth > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine.trim()) {
            lines.push(currentLine.trim());
        }

        return lines;
    }

    getTextWidth(text) {
        // Approximate text width (this is a simplified version)
        return text.length * 2.5; // Rough estimate
    }

    getTextHeight(text, maxWidth) {
        const lines = this.wrapText(text, maxWidth);
        return lines.length * 5; // 5mm per line
    }

    // IMPROVED METHOD: Generate PDF from HTML element with intelligent page breaks
    async generatePDFFromElement(element, options = {}) {
        try {
            await this.initializeLibraries();

            const {
                filename = 'report.pdf',
                format = 'a4',
                orientation = 'portrait',
                margin = 15,
                quality = 0.95,
                enableSmartPageBreaks = false, // Disable smart breaks for now
                headerHeight = 80,
                footerHeight = 30
            } = options;

            console.log('Starting simplified PDF generation...');

            // Use simple method for now
            const pdf = await this.generateSimplePDF(element, options);

            return { pdf, filename };
        } catch (error) {
            console.error('Error generating PDF from element:', error);
            throw error;
        }
    }

    // SIMPLIFIED PDF GENERATION METHOD
    async generateSimplePDF(element, options) {
        const { format, margin, quality, headerHeight, footerHeight } = options;
        const { jsPDF } = this.jsPDF;
        const pdf = new jsPDF('p', 'mm', format);
        
        console.log('Generating simple PDF...');
        console.log('Element to convert:', element);
        console.log('Element innerHTML length:', element.innerHTML.length);
        console.log('Element scroll dimensions:', {
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight
        });

        // Ensure element is visible for capture
        const originalStyles = {
            position: element.style.position,
            left: element.style.left,
            top: element.style.top,
            zIndex: element.style.zIndex,
            opacity: element.style.opacity,
            visibility: element.style.visibility
        };

        // Make element visible for capture with PDF-optimized width
        element.style.position = 'relative';
        element.style.left = '0';
        element.style.top = '0';
        element.style.zIndex = '1';
        element.style.opacity = '1';
        element.style.visibility = 'visible';
        element.style.background = 'white';
        element.style.width = '800px'; // Force PDF width
        element.style.maxWidth = '800px'; // Ensure max width
        element.style.margin = '0 auto'; // Center the content

        console.log('Element made visible. New dimensions:', {
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
            offsetWidth: element.offsetWidth,
            offsetHeight: element.offsetHeight
        });

        try {
            // Generate canvas from element with improved configuration
            const canvas = await this.html2canvas(element, {
                scale: 1, // Reduced scale for better compatibility
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: 800, // Force width to 800px for PDF
                height: element.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 800, // Force window width
                windowHeight: element.scrollHeight,
                x: 0,
                y: 0,
                foreignObjectRendering: false, // Disabled for better compatibility
                imageTimeout: 30000, // Increased timeout
                logging: true, // Enable logging
                removeContainer: false,
                onclone: function(clonedDoc) {
                    console.log('Cloning document for canvas generation...');
                    
                    // Force PDF-optimized width on cloned element
                    const clonedElement = clonedDoc.querySelector('#pdfContainer') || clonedDoc.body;
                    if (clonedElement) {
                        clonedElement.style.width = '800px';
                        clonedElement.style.maxWidth = '800px';
                        clonedElement.style.margin = '0 auto';
                        clonedElement.style.fontSize = '12px';
                    }
                    
                    // Ensure all images are visible and properly sized
                    const clonedImages = clonedDoc.querySelectorAll('img');
                    clonedImages.forEach(img => {
                        img.style.display = 'block';
                        img.style.visibility = 'visible';
                        img.style.opacity = '1';
                        img.style.maxWidth = '150px'; // Limit image size for PDF
                        img.style.height = 'auto';
                        console.log('Image processed:', img.src);
                    });
                    
                    // Ensure all text is visible
                    const allElements = clonedDoc.querySelectorAll('*');
                    allElements.forEach(el => {
                        if (el.style) {
                            el.style.color = el.style.color || '#000000';
                            el.style.backgroundColor = el.style.backgroundColor || 'transparent';
                        }
                    });
                    
                    console.log('Document cloned successfully');
                }
            });

            console.log('Canvas generated:', canvas.width, 'x', canvas.height);
            console.log('Canvas data URL length:', canvas.toDataURL().length);
            
            // Test if canvas has content
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hasContent = imageData.data.some(pixel => pixel !== 0);
            console.log('Canvas has content:', hasContent);
            
            if (!hasContent) {
                console.error('❌ Canvas is empty! This is the problem.');
                throw new Error('Canvas generation failed - canvas is empty');
            }

            // Calculate PDF dimensions
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const contentWidth = pageWidth - (margin * 2);
            const contentHeight = pageHeight - (headerHeight + footerHeight + (margin * 2));

            // Calculate image dimensions
            const imgWidth = contentWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            console.log('PDF dimensions:', {
                pageWidth,
                pageHeight,
                contentWidth,
                contentHeight,
                imgWidth,
                imgHeight
            });

            // Calculate number of pages needed
            const pagesNeeded = Math.ceil(imgHeight / contentHeight);
            console.log('Pages needed:', pagesNeeded);

            // Add content to PDF pages
            for (let page = 0; page < pagesNeeded; page++) {
                if (page > 0) {
                    pdf.addPage();
                }

                // Add page header
                this.addPageHeader(pdf, page + 1, pagesNeeded, headerHeight);

                // Calculate source and destination coordinates for this page
                const sourceY = page * contentHeight * (canvas.height / imgHeight);
                const sourceHeight = Math.min(contentHeight * (canvas.height / imgHeight), canvas.height - sourceY);
                const destHeight = (sourceHeight * imgWidth) / canvas.width;

                console.log(`Page ${page + 1}:`, {
                    sourceY,
                    sourceHeight,
                    destHeight,
                    position: margin
                });

                // Add image to PDF
                pdf.addImage(
                    canvas.toDataURL('image/jpeg', quality),
                    'JPEG',
                    margin,
                    headerHeight + margin,
                    imgWidth,
                    destHeight,
                    '',
                    'FAST',
                    0,
                    sourceY,
                    canvas.width,
                    sourceHeight
                );

                // Add page footer
                this.addPageFooter(pdf, page + 1, pagesNeeded, footerHeight);
            }

            return pdf;
        } finally {
            // Restore original styles
            element.style.position = originalStyles.position;
            element.style.left = originalStyles.left;
            element.style.top = originalStyles.top;
            element.style.zIndex = originalStyles.zIndex;
            element.style.opacity = originalStyles.opacity;
            element.style.visibility = originalStyles.visibility;
        }
    }

    // NEW METHOD: Analyze content structure for better page breaks
    analyzeContentStructure(element) {
        const analysis = {
            totalHeight: element.scrollHeight,
            sections: [],
            images: [],
            tables: [],
            criticalElements: []
        };

        // Find all major sections
        const sections = element.querySelectorAll('div[class*="section"], div[class*="container"], div[class*="block"]');
        sections.forEach((section, index) => {
            const rect = section.getBoundingClientRect();
            analysis.sections.push({
                id: section.id || `section-${index}`,
                element: section,
                top: rect.top,
                height: rect.height,
                bottom: rect.bottom,
                type: this.getElementType(section),
                shouldNotSplit: this.shouldNotSplitElement(section)
            });
        });

        // Find all images
        const images = element.querySelectorAll('img');
        images.forEach((img, index) => {
            const rect = img.getBoundingClientRect();
            analysis.images.push({
                id: img.id || `image-${index}`,
                element: img,
                top: rect.top,
                height: rect.height,
                bottom: rect.bottom,
                src: img.src
            });
        });

        // Find all tables
        const tables = element.querySelectorAll('table');
        tables.forEach((table, index) => {
            const rect = table.getBoundingClientRect();
            analysis.tables.push({
                id: table.id || `table-${index}`,
                element: table,
                top: rect.top,
                height: rect.height,
                bottom: rect.bottom,
                shouldNotSplit: true // Tables should never be split
            });
        });

        // Find critical elements that should not be split
        const criticalElements = element.querySelectorAll('h1, h2, h3, h4, h5, h6, .no-break, .keep-together');
        criticalElements.forEach((el, index) => {
            const rect = el.getBoundingClientRect();
            analysis.criticalElements.push({
                id: el.id || `critical-${index}`,
                element: el,
                top: rect.top,
                height: rect.height,
                bottom: rect.bottom,
                type: el.tagName.toLowerCase()
            });
        });

        return analysis;
    }

    // NEW METHOD: Calculate smart page breaks
    calculateSmartPageBreaks(analysis, format, margin, headerHeight, footerHeight) {
        const pageBreaks = [];
        const pageHeight = this.getPageHeight(format) - (headerHeight + footerHeight + (margin * 2));
        let currentPageHeight = 0;
        let currentPage = 0;

        // Sort all elements by their position
        const allElements = [
            ...analysis.sections,
            ...analysis.images,
            ...analysis.tables,
            ...analysis.criticalElements
        ].sort((a, b) => a.top - b.top);

        allElements.forEach(element => {
            const elementHeight = element.height;
            
            // Check if element should not be split
            if (element.shouldNotSplit || element.type === 'table') {
                // If element doesn't fit on current page, start new page
                if (currentPageHeight + elementHeight > pageHeight) {
                    pageBreaks.push({
                        page: currentPage,
                        height: currentPageHeight,
                        elements: []
                    });
                    currentPage++;
                    currentPageHeight = 0;
                }
            }

            // Add element to current page
            currentPageHeight += elementHeight;

            // Check if we need a new page
            if (currentPageHeight > pageHeight) {
                pageBreaks.push({
                    page: currentPage,
                    height: pageHeight,
                    elements: []
                });
                currentPage++;
                currentPageHeight = elementHeight;
            }
        });

        // Add final page
        if (currentPageHeight > 0) {
            pageBreaks.push({
                page: currentPage,
                height: currentPageHeight,
                elements: []
            });
        }

        return pageBreaks;
    }

    // NEW METHOD: Calculate simple page breaks (fallback)
    calculateSimplePageBreaks(analysis, format, margin, headerHeight, footerHeight) {
        const pageHeight = this.getPageHeight(format) - (headerHeight + footerHeight + (margin * 2));
        const pagesNeeded = Math.ceil(analysis.totalHeight / pageHeight);
        const pageBreaks = [];

        for (let i = 0; i < pagesNeeded; i++) {
            pageBreaks.push({
                page: i,
                height: pageHeight,
                startY: i * pageHeight,
                endY: (i + 1) * pageHeight
            });
        }

        return pageBreaks;
    }

    // NEW METHOD: Generate PDF with smart page breaks
    async generatePDFWithSmartBreaks(element, pageBreaks, options) {
        const { format, margin, quality, headerHeight, footerHeight } = options;
                    const { jsPDF } = this.jsPDF;
            const pdf = new jsPDF('p', 'mm', format);
        const pageHeight = this.getPageHeight(format);

        console.log(`Generating PDF with ${pageBreaks.length} pages...`);

        for (let pageIndex = 0; pageIndex < pageBreaks.length; pageIndex++) {
            const pageBreak = pageBreaks[pageIndex];
            
            if (pageIndex > 0) {
                pdf.addPage();
            }

            // Create a temporary container for this page
            const pageContainer = this.createPageContainer(element, pageBreak, options);
            
            // Generate canvas for this page
            const canvas = await this.html2canvas(pageContainer, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: pageContainer.scrollWidth,
                height: pageContainer.scrollHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: pageContainer.scrollWidth,
                windowHeight: pageContainer.scrollHeight,
                x: 0,
                y: 0,
                foreignObjectRendering: true,
                imageTimeout: 20000,
                onclone: function(clonedDoc) {
                    // Ensure all images are visible
                    const clonedImages = clonedDoc.querySelectorAll('img');
                    clonedImages.forEach(img => {
                        img.style.display = 'block';
                        img.style.visibility = 'visible';
                        img.style.opacity = '1';
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                    });
                }
            });

            // Add page header
            this.addPageHeader(pdf, pageIndex + 1, pageBreaks.length, headerHeight);

            // Add content to PDF
            const imgData = canvas.toDataURL('image/jpeg', quality);
            const imgWidth = pageHeight - (headerHeight + footerHeight + (margin * 2));
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(
                imgData,
                'JPEG',
                margin,
                headerHeight + margin,
                imgWidth,
                imgHeight
            );

            // Add page footer
            this.addPageFooter(pdf, pageIndex + 1, pageBreaks.length, footerHeight);

            // Clean up temporary container
            if (pageContainer.parentNode) {
                pageContainer.parentNode.removeChild(pageContainer);
            }
        }

        return pdf;
    }

    // NEW METHOD: Create page container for specific page
    createPageContainer(originalElement, pageBreak, options) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: absolute;
            left: -9999px;
            top: 0;
            width: ${originalElement.scrollWidth}px;
            height: ${pageBreak.height}px;
            overflow: hidden;
            background: white;
        `;

        // Clone the original element
        const clonedElement = originalElement.cloneNode(true);
        
        // Position the cloned element to show only the content for this page
        clonedElement.style.cssText = `
            position: relative;
            top: -${pageBreak.startY || 0}px;
            width: 100%;
            height: auto;
        `;

        container.appendChild(clonedElement);
        document.body.appendChild(container);

        return container;
    }

    // NEW METHOD: Add page header
    addPageHeader(pdf, pageNumber, totalPages, headerHeight) {
        pdf.setFontSize(12);
        pdf.setTextColor(107, 114, 128);
        pdf.text(`Page ${pageNumber} of ${totalPages}`, 20, headerHeight - 10);
    }

    // NEW METHOD: Add page footer
    addPageFooter(pdf, pageNumber, totalPages, footerHeight) {
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, pageHeight - footerHeight + 10);
    }

    // NEW METHOD: Get page height in mm
    getPageHeight(format) {
        const sizes = {
            'a4': 297,
            'a3': 420,
            'letter': 279,
            'legal': 356
        };
        return sizes[format] || 297;
    }

    // NEW METHOD: Determine element type
    getElementType(element) {
        if (element.tagName === 'TABLE') return 'table';
        if (element.tagName === 'IMG') return 'image';
        if (element.classList.contains('section')) return 'section';
        if (element.classList.contains('container')) return 'container';
        return 'div';
    }

    // NEW METHOD: Check if element should not be split
    shouldNotSplitElement(element) {
        const noSplitClasses = ['no-break', 'keep-together', 'section', 'header', 'footer'];
        const noSplitTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'IMG'];
        
        return noSplitClasses.some(cls => element.classList.contains(cls)) ||
               noSplitTags.includes(element.tagName) ||
               element.style.pageBreakInside === 'avoid';
    }

    // Method to download PDF
    downloadPDF(pdf, filename) {
        try {
            pdf.save(filename);
            return true;
        } catch (error) {
            console.error('Error downloading PDF:', error);
            return false;
        }
    }
}

// Export for both browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFGenerator;
} else if (typeof window !== 'undefined') {
    window.PDFGenerator = PDFGenerator;
} 